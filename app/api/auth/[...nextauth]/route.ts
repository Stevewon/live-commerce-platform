import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import KakaoProvider from "next-auth/providers/kakao"
import NaverProvider from "next-auth/providers/naver"
import CredentialsProvider from "next-auth/providers/credentials"
import { getPrisma } from '@/lib/prisma'
import bcrypt from "bcryptjs"

// OAuth Providers 동적 구성
const providers: any[] = [];

// Google OAuth (클라이언트 ID가 설정된 경우에만)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id') {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    })
  );
}

// Naver OAuth (클라이언트 ID가 설정된 경우에만)
if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_ID !== 'your-naver-client-id') {
  providers.push(
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET || "",
    })
  );
}

// Kakao OAuth (클라이언트 ID가 설정된 경우에만)
if (process.env.KAKAO_CLIENT_ID && process.env.KAKAO_CLIENT_ID !== 'your-kakao-client-id') {
  providers.push(
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID,
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    })
  );
}

// 기존 이메일/비밀번호 로그인 (항상 활성화)
providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const prisma = await getPrisma();
      try {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) return null

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      } finally {
        await prisma.$disconnect().catch(() => {});
      }
    }
  })
);

const authOptions = {
  providers,
  
  callbacks: {
    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      if (account?.provider && account?.provider !== "credentials") {
        const prisma = await getPrisma();
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: token.email as string }
          })
          if (existingUser) {
            token.id = existingUser.id
            token.role = existingUser.role
          }
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      }
      
      return token
    },
    
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    
    async signIn({ user, account }: any) {
      if (account?.provider && account?.provider !== "credentials") {
        const prisma = await getPrisma();
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email as string }
          })
          
          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email as string,
                name: user.name || "User",
                password: "",
                role: "CUSTOMER",
              }
            })
          }
          return true
        } catch (error) {
          console.error("Sign in error:", error)
          return false
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      }
      return true
    }
  },
  
  pages: {
    signIn: "/login",
    error: "/login",
  },
  
  session: {
    strategy: "jwt" as const,
    maxAge: 30 * 24 * 60 * 60,
  },
  
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  trustHost: true,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
