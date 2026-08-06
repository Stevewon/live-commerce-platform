// ─────────────────────────────────────────────────────────────────────────
// [공용] 주문 취소/환불 핵심 로직
//   관리자 주문 상세(PATCH)와 중복주문 정리(cleanup)에서 "동일한" 검증된 로직을
//   쓰기 위해 분리. 잔액 환불(KRW/QKEY/SPLIT) + QTA 적립 회수 + 재고 복구 +
//   B회원(QRChat) Firebase 쿠키 재적립까지 멱등 처리.
//   ⚠️ user-facing / BalanceLedger reason 문자열은 안전한 한글만 사용.
// ─────────────────────────────────────────────────────────────────────────
import { QKEY_TO_KRW, newId, getD1 } from '@/lib/balance';
import { refundQkeyForQrlive, normWallet, normNick } from '@/lib/qrchat-bridge';

export interface RefundOrderInput {
  id: string;
  userId: string | null;
  paymentMethod: string | null;
  total: number;
  refundedAt: any;
  paidQkey?: number;
  paidKrw?: number;
}

export interface RefundResult {
  refunded: boolean;
  currency?: 'KRW' | 'QKEY' | 'SPLIT';
  amount?: number;
  qkey?: number;
  krw?: number;
  pendingFirebaseQkey?: number;
}

// 주문 취소/환불 시 결제했던 잔액을 원자적으로 환불 (멱등: refundedAt 있으면 스킵)
// - B회원(qrchatUser 전달) 의 QKEY 는 로컬 대신 pendingFirebaseQkey 로 반환 → 커밋 후 Firebase 재적립.
export async function refundOrderBalance(
  tx: any,
  order: RefundOrderInput,
  reason: string,
  qrchatUser?: { uid: string; wallet: string; nick: string } | null
): Promise<RefundResult> {
  const method = order.paymentMethod || '';
  const isKrw = method === 'KRW_BALANCE';
  const isQkey = method === 'QKEY_BALANCE';
  const isSplit = method === 'SPLIT_BALANCE';

  if ((!isKrw && !isQkey && !isSplit) || !order.userId || order.refundedAt) {
    return { refunded: false };
  }

  const refundQkey = isQkey
    ? Math.ceil(order.total / QKEY_TO_KRW)
    : isSplit
      ? (Number(order.paidQkey) || 0)
      : 0;
  const refundKrw = isKrw
    ? order.total
    : isSplit
      ? (Number(order.paidKrw) || 0)
      : 0;
  if (refundQkey <= 0 && refundKrw <= 0) return { refunded: false };

  const refundOne = async (column: 'krwBalance' | 'qkeyBalance', currency: 'KRW' | 'QKEY', amount: number) => {
    if (amount <= 0) return;
    const balRows: any = await tx.$queryRawUnsafe(
      `SELECT "${column}" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
      order.userId
    );
    const balRow = Array.isArray(balRows) ? balRows[0] : balRows;
    const afterBal = (Number(balRow?.bal) || 0) + amount;
    await tx.$executeRawUnsafe(
      `UPDATE "User" SET "${column}" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
      afterBal, order.userId
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "BalanceLedger"
         ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      newId(), order.userId, currency, amount /* 양수 = 환불 */, afterBal, reason, order.id
    );
  };

  let pendingFirebaseQkey = 0;
  if (qrchatUser && refundQkey > 0) {
    pendingFirebaseQkey = refundQkey;
  } else {
    await refundOne('qkeyBalance', 'QKEY', refundQkey);
  }
  await refundOne('krwBalance', 'KRW', refundKrw);

  if (isSplit) {
    return { refunded: true, currency: 'SPLIT', amount: order.total, qkey: refundQkey, krw: refundKrw, pendingFirebaseQkey };
  }
  return {
    refunded: true,
    currency: isKrw ? 'KRW' : 'QKEY',
    amount: isKrw ? refundKrw : refundQkey,
    pendingFirebaseQkey,
  };
}

// [QTA 적립 회수] 취소/환불 시 해당 주문으로 적립된 QTA 를 자동 회수 (멱등)
export async function recoverOrderQta(
  tx: any,
  order: { id: string; userId: string | null },
): Promise<{ recovered: boolean; amount?: number }> {
  if (!order.userId) return { recovered: false };

  const qtaSumRows: any = await tx.$queryRawUnsafe(
    `SELECT
       COALESCE(SUM(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END), 0) AS earned,
       COALESCE(SUM(CASE WHEN "amount" < 0 THEN -"amount" ELSE 0 END), 0) AS reversed
     FROM "BalanceLedger"
     WHERE "relatedOrderId" = ? AND "currency" = 'QTA'`,
    order.id
  );
  const qtaSumRow = Array.isArray(qtaSumRows) ? qtaSumRows[0] : qtaSumRows;
  const earnedQta = Number(qtaSumRow?.earned) || 0;
  const reversedQta = Number(qtaSumRow?.reversed) || 0;
  const recoverTarget = earnedQta - reversedQta;
  if (recoverTarget <= 0) return { recovered: false };

  const qtaBalRows: any = await tx.$queryRawUnsafe(
    `SELECT "qtaBalance" AS bal FROM "User" WHERE "id" = ? LIMIT 1`,
    order.userId
  );
  const qtaBalRow = Array.isArray(qtaBalRows) ? qtaBalRows[0] : qtaBalRows;
  const curQta = Number(qtaBalRow?.bal) || 0;
  const recoverAmount = Math.min(recoverTarget, curQta);
  if (recoverAmount <= 0) return { recovered: false };

  const afterQta = curQta - recoverAmount;
  await tx.$executeRawUnsafe(
    `UPDATE "User" SET "qtaBalance" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`,
    afterQta, order.userId
  );
  await tx.$executeRawUnsafe(
    `INSERT INTO "BalanceLedger"
       ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
    newId(), order.userId, 'QTA', -recoverAmount, afterQta, '구매 적립 취소', order.id
  );

  return { recovered: true, amount: recoverAmount };
}

// [B회원 판정] 주문 회원이 QRChat B회원(uid+지갑+닉)인지 조회.
//   B회원의 QKEY 는 Firebase 실쿠키에서 결제됐으므로 취소 시 Firebase 로 되돌려야 함.
export async function resolveQrchatUserForOrder(userId: string | null): Promise<{ uid: string; wallet: string; nick: string } | null> {
  if (!userId) return null;
  try {
    const d1 = await getD1();
    const uRows: any = await d1
      .prepare(`SELECT "qrchatUid","securetQrUrl","nickname","name" FROM "User" WHERE "id" = ? LIMIT 1`)
      .bind(userId)
      .all();
    const uRow = (uRows?.results && uRows.results[0]) || (Array.isArray(uRows) ? uRows[0] : null);
    if (uRow) {
      const uid = String(uRow.qrchatUid || '').trim();
      const wallet = normWallet(uRow.securetQrUrl);
      const nick = normNick(uRow.nickname || uRow.name);
      if (uid && wallet && nick) return { uid, wallet, nick };
    }
  } catch (e) {
    console.warn('[주문환불] B회원 판정 조회 실패(로컬환불 폴백):', e);
  }
  return null;
}

// [B회원] 커밋 후 Firebase 실쿠키(QKEY) 재적립 + 로컬 원장 기록 (멱등: refund:orderId)
export async function refundFirebaseQkeyAfterCommit(
  order: { id: string; userId: string | null },
  qrchatUser: { uid: string; wallet: string; nick: string },
  pendingFirebaseQkey: number,
  reason: string
): Promise<void> {
  if (!qrchatUser || pendingFirebaseQkey <= 0) return;
  try {
    const r = await refundQkeyForQrlive({
      uid: qrchatUser.uid,
      wallet: qrchatUser.wallet,
      nick: qrchatUser.nick,
      amountQkey: pendingFirebaseQkey,
      orderId: order.id,
      idemKey: `refund:${order.id}`,
    });
    if (r && r.ok) {
      try {
        await (await getD1())
          .prepare(
            `INSERT INTO "BalanceLedger"
               ("id","userId","currency","amount","balanceAfter","reason","relatedOrderId","relatedRequestId","createdAt")
             VALUES (?, ?, 'QKEY', ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`
          )
          .bind(newId(), order.userId, pendingFirebaseQkey, Number((r as any).newBalance) || 0, reason, order.id)
          .run();
      } catch (ledgerErr) {
        console.warn('[주문환불] Firebase QKEY 원장 기록 실패(무시):', ledgerErr);
      }
    } else {
      console.error('[주문환불] Firebase QKEY 재적립 실패:', (r as any)?.error);
    }
  } catch (e) {
    console.error('[주문환불] refundQkeyForQrlive 예외:', e);
  }
}
