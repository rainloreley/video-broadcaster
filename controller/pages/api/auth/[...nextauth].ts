import NextAuth from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";

export const authOptions = {
    providers: [
        AuthentikProvider({
            clientId: process.env.OIDC_CLIENT_ID!,
            clientSecret: process.env.OIDC_CLIENT_SECRET!,
            issuer: process.env.OIDC_ISSUER
        })
    ]
}

export default NextAuth(authOptions)