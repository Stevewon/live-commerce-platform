import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      email,
      password,
      name,
      phone,
      storeName,
      storeSlug,
      description,
      youtubeUrl,
      africaTvUrl,
      instagramUrl
    } = body

    // 필수 필드 확인
    if (!email || !password || !name || !phone || !storeName || !storeSlug) {
      return NextResponse.json(
        { error: '필수 항목을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다' },
        { status: 400 }
      )
    }

    // 상점 slug 중복 확인
    const existingStore = await prisma.partner.findUnique({
      where: { storeSlug }
    })

    if (existingStore) {
      return NextResponse.json(
        { error: '이미 사용 중인 상점 URL입니다' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10)

    // 사용자 및 파트너 생성 (트랜잭션)
    const result = await prisma.$transaction(async (tx) => {
      // 1. 사용자 생성
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role: 'PARTNER'
        }
      })

      // 2. 파트너 정보 생성
      const partner = await tx.partner.create({
        data: {
          userId: user.id,
          storeName,
          storeSlug,
          description: description || '',
          youtubeUrl: youtubeUrl || null,
          africaTvUrl: africaTvUrl || null,
          instagramUrl: instagramUrl || null,
          commissionRate: 30.0, // 기본 수수료율 30%
          isActive: true
        }
      })

      return { user, partner }
    })

    // 비밀번호 제외하고 반환
    const { password: _, ...userWithoutPassword } = result.user

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      partner: result.partner,
      message: '파트너 등록이 완료되었습니다'
    }, { status: 201 })

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
