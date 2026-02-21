import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import KakaoProvider from "next-auth/providers/kakao"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    
    // Kakao OAuth
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),
    
    // 기존 이메일/비밀번호 로그인
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // 소셜 로그인 시 계정 연결
      if (account?.provider && account?.provider !== "credentials") {
        // 이미 존재하는 사용자인지 확인
        const existingUser = await prisma.user.findUnique({
          where: { email: token.email as string }
        })
        
        if (existingUser) {
          token.id = existingUser.id
          token.role = existingUser.role
        }
      }
      
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
    
    async signIn({ user, account, profile }) {
      // 소셜 로그인 시 사용자 생성 또는 업데이트
      if (account?.provider && account?.provider !== "credentials") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email as string }
          })
          
          if (!existingUser) {
            // 새 사용자 생성 (소셜 로그인)
            await prisma.user.create({
              data: {
                email: user.email as string,
                name: user.name || "User",
                password: "", // 소셜 로그인은 비밀번호 불필요
                role: "CUSTOMER",
              }
            })
          }
          
          return true
        } catch (error) {
          console.error("Sign in error:", error)
          return false
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
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
