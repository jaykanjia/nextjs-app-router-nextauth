import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import Auth0Provider from "next-auth/providers/auth0";

type LoginCredentials = {
	email: string;
	password: string;
};

const StrapiLogin = async (credentials: LoginCredentials) => {
	// Debug log for credentials
	const raw = {
		identifier: credentials.email,
		password: credentials.password,
	};

	const res = await fetch(`${process.env.BACKEND_URL}/api/auth/local`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(raw),
	});

	// if (!res.ok) {
	// 	console.error("Failed to fetch user, response status:", res.status); // Debug log for response status
	// 	throw new Error("Failed to fetch user");
	// }

	const data = await res.json();
	return data;
};

const handler = NextAuth({
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
		}),
		DiscordProvider({
			clientId: process.env.DISCORD_CLIENT_ID || "",
			clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
		}),
		Auth0Provider({
			clientId: process.env.AUTH0_CLIENT_ID || "",
			clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
			issuer: process.env.AUTH0_ISSUER || "",
		}),
		CredentialsProvider({
			id: "strapi-credentials",
			name: "Strapi Credentials",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				try {
					if (!credentials) {
						return null;
					}

					const data = await StrapiLogin({
						email: credentials.email,
						password: credentials.password,
					});

					// Debugging the data from Strapi
					console.log("Strapi response:", { data });

					// Check the structure of the response
					if (data?.user) {
						return {
							id: data.user.id,
							name: data.user.username,
							email: data.user.email,
							strapiToken: data.jwt,
							blocked: data.user.blocked,
						};
					} else {
						console.error("No user found in response");
						return null;
					}
				} catch (error) {
					console.error("Authorize error:", error);
					throw new Error(
						JSON.stringify({ errors: "Authorize error", status: false })
					);
				}
			},
		}),
	],
	pages: {
		signIn: "/auth/signin",
		error: "/auth/error",
	},
	session: { strategy: "jwt" },
	callbacks: {
		async signIn(userDetail) {
			console.log("signin");

			if (Object.keys(userDetail).length === 0) {
				return false;
			}
			return true;
		},
		async redirect({ baseUrl }) {
			console.log("redirect");
			return `${baseUrl}/protected`;
		},
		async session({ session, token }) {
			console.log("session");
			const newSession = { ...session } as any;
			if (session.user) {
				newSession.user.name = token.name;
				newSession.user.email = token.email;
				newSession.strapiToken = token.strapiToken;
				newSession.user.strapiUserId = token.strapiUserId;
				newSession.user.blocked = token.blocked;
			}
			console.log("session", { newSession });

			return newSession;
		},
		async jwt({ token, user, account }) {
			console.log("login with", account?.provider);

			let newUser = { ...user } as any;
			// if (newUser.first_name && newUser.last_name)
			// 	token.name = `${newUser.first_name} ${newUser.last_name}`;
			token.strapiToken = newUser.strapiToken;
			token.strapiUserId = newUser.id;
			token.blocked = newUser.blocked;

			console.log("jwt", { token });
			return token;
		},
	},
});

export { handler as GET, handler as POST };
