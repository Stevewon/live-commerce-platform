/**
 * Delivery Tracker (tracker.delivery) 배송추적 클라이언트
 * ============================================================================
 * 목적: CJ대한통운 등 외부 택배사 사이트로 나가지 않고, 우리 서버가 배송추적
 *       데이터를 받아와 인앱(모바일 최적화) 화면으로 보여주기 위함.
 *
 * ⚠️ 서버 전용 (Route Handler)에서만 호출. Client 번들 노출 금지.
 *
 * ⚙️ 필요한 환경변수 (wrangler secret 또는 wrangler.jsonc vars):
 *   - DELIVERY_TRACKER_CLIENT_ID     : Delivery Tracker Console 발급 Client ID
 *   - DELIVERY_TRACKER_CLIENT_SECRET : Delivery Tracker Console 발급 Client Secret
 *   두 값이 모두 없으면 인앱 추적 비활성 → 프론트는 외부 링크로 폴백한다.
 *
 * 인증: OAuth2 Client Credentials (auth.tracker.delivery/oauth2/token)
 *       → Bearer 토큰으로 apis.tracker.delivery/graphql 호출.
 *       토큰은 만료 전까지 모듈 스코프에 캐시.
 * 문서: https://tracker.delivery/docs/authentication
 *       https://tracker.delivery/docs/tracking-api
 */

const AUTH_URL = 'https://auth.tracker.delivery/oauth2/token';
const GRAPHQL_URL = 'https://apis.tracker.delivery/graphql';

export interface TrackEvent {
  /** ISO8601 시각 (예: 2024-01-02T13:04:05+09:00) */
  time: string | null;
  /** 상태 코드 (예: DELIVERED, IN_TRANSIT ...) */
  statusCode: string | null;
  /** 상태 라벨 (예: 배송완료) */
  statusName: string | null;
  /** 상세 설명 */
  description: string | null;
  /** 위치명 (예: 서울강남택배점) */
  location: string | null;
}

export interface TrackResult {
  carrierName: string | null;
  trackingNumber: string;
  from: string | null;
  to: string | null;
  events: TrackEvent[];
}

export interface TrackOutcome {
  ok: boolean;
  /** 인앱 추적 지원 여부 (credentials/carrierId 없으면 false → 외부링크 폴백) */
  supported: boolean;
  data?: TrackResult;
  /** 사용자 노출용 안전 메시지 (한국어) */
  error?: string;
  /** 내부 진단용 */
  detail?: string;
}

function getCredentials(): { id: string; secret: string } | null {
  const id = process.env.DELIVERY_TRACKER_CLIENT_ID;
  const secret = process.env.DELIVERY_TRACKER_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

/** 인앱 추적을 쓸 수 있는지 (credentials 존재 여부) */
export function isInAppTrackingEnabled(): boolean {
  return getCredentials() !== null;
}

// --- OAuth2 액세스 토큰 캐시 (모듈 스코프) ------------------------------------
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(force = false): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  const now = Date.now();
  if (!force && cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.id,
    client_secret: creds.secret,
  });

  const resp = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`oauth2_failed_${resp.status}:${t.slice(0, 200)}`);
  }

  const json: any = await resp.json().catch(() => ({}));
  const token = json?.access_token;
  if (!token) throw new Error('oauth2_no_access_token');

  const expiresIn = Number(json?.expires_in) || 3600; // seconds
  cachedToken = { token, expiresAt: now + expiresIn * 1000 };
  return token;
}

const TRACK_QUERY = `
query Track($carrierId: ID!, $trackingNumber: String!) {
  track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
    from { name time }
    to { name time }
    events(last: 30) {
      edges {
        node {
          time
          status { code name }
          description
          location { name }
        }
      }
    }
  }
}`;

/**
 * 운송장 추적. credentials 없으면 supported=false 반환 (외부 링크로 폴백해야 함).
 */
export async function trackShipment(
  carrierId: string | null,
  trackingNumber: string
): Promise<TrackOutcome> {
  if (!carrierId) {
    return { ok: false, supported: false, error: '인앱 배송추적을 지원하지 않는 택배사입니다.' };
  }
  if (!getCredentials()) {
    return { ok: false, supported: false, error: '인앱 배송추적이 아직 설정되지 않았습니다.' };
  }
  if (!trackingNumber) {
    return { ok: false, supported: true, error: '운송장 번호가 없습니다.' };
  }

  const runQuery = async (token: string): Promise<Response> =>
    fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: TRACK_QUERY,
        variables: { carrierId, trackingNumber },
      }),
    });

  try {
    let token = await getAccessToken();
    if (!token) {
      return { ok: false, supported: false, error: '인앱 배송추적이 아직 설정되지 않았습니다.' };
    }

    let resp = await runQuery(token);
    let json: any = await resp.json().catch(() => ({}));

    // UNAUTHENTICATED → 토큰 강제 갱신 후 1회 재시도
    const unauth = Array.isArray(json?.errors)
      && json.errors.some((e: any) => e?.extensions?.code === 'UNAUTHENTICATED');
    if (unauth) {
      token = await getAccessToken(true);
      if (token) {
        resp = await runQuery(token);
        json = await resp.json().catch(() => ({}));
      }
    }

    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      const code = json.errors[0]?.extensions?.code || '';
      const msg = json.errors[0]?.message || 'unknown';
      // NOT_FOUND 류는 사용자에게 부드럽게 안내
      if (/NOT_FOUND|BAD_REQUEST/i.test(code)) {
        return {
          ok: false,
          supported: true,
          error: '아직 배송 정보가 등록되지 않았거나 운송장 번호를 찾을 수 없습니다.',
          detail: `${code}:${msg}`,
        };
      }
      return { ok: false, supported: true, error: '배송 정보를 불러오지 못했습니다.', detail: `${code}:${msg}` };
    }

    const track = json?.data?.track;
    if (!track) {
      return { ok: false, supported: true, error: '아직 배송 정보가 등록되지 않았습니다.', detail: 'empty_track' };
    }

    const edges: any[] = track?.events?.edges ?? [];
    const events: TrackEvent[] = edges
      .map((e) => e?.node)
      .filter(Boolean)
      .map((n: any) => ({
        time: n?.time ?? null,
        statusCode: n?.status?.code ?? null,
        statusName: n?.status?.name ?? null,
        description: n?.description ?? null,
        location: n?.location?.name ?? null,
      }))
      // 최신순 정렬 (time 내림차순)
      .sort((a, b) => {
        const ta = a.time ? Date.parse(a.time) : 0;
        const tb = b.time ? Date.parse(b.time) : 0;
        return tb - ta;
      });

    return {
      ok: true,
      supported: true,
      data: {
        carrierName: null,
        trackingNumber,
        from: track?.from?.name ?? null,
        to: track?.to?.name ?? null,
        events,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      supported: true,
      error: '배송 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
      detail: String(err?.message || err).slice(0, 300),
    };
  }
}
