import { Hono } from "hono";
import { auth } from "./lib/auth.js";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { PrismaClient } from "@prisma/client";
import { logger } from "hono/logger";
import { decode, sign, verify } from "hono/jwt";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const app = new Hono();
app.use(logger());
app.use(
	"*",
	cors({
		origin: "*",
	}),
);
app.post("/api/register", async (c) => {
	const { email, password } = await c.req.json();

	const hashedPassword = await bcrypt.hash(password, 10);

	const user = await prisma.user.create({
		data: { email, password: hashedPassword },
	});

	const payload = {
		sub: user.id,
		email: user.email,
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
	};
	const token = await sign(payload, "secret");

	return c.json({
		token,
	});
});

app.post("/api/login", async (c) => {
	const { email, password } = await c.req.json();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		return c.json({ error: "User not found" }, 401);
	}

	const isPasswordValid = await bcrypt.compare(password, user.password);

	if (!isPasswordValid) {
		return c.json({ error: "Invalid password" }, 401);
	}

	const payload = {
		sub: user.id,
		email: user.email,
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
	};
	const token = await sign(payload, "secret");

	return c.json({
		token,
	});
});

app.get("/api/state", async (c) => {
	const token = c.req.query("token");

	console.log(token);

	if (!token) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const payload = await verify(token, "secret");

	console.log(payload);

	const user = await prisma.user.findFirst({
		where: { id: payload.sub as string },
	});

	console.log(user);

	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	return c.json({
		user,
	});
});

app.post("/api/state", async (c) => {
	const token = c.req.query("token");
	const { health, apples, laughter, medicine, coins } = await c.req.json();

	console.log(token, health, apples, laughter, medicine, coins);

	const payload = await verify(token, "secret");

	console.log(payload);

	const user = await prisma.user.findFirst({
		where: { id: payload.sub as string },
	});

	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const updatedUser = await prisma.user.update({
		where: { id: user.id },
		data: {
			health,
			apples,
			laughter,
			medicine,
			coins,
		},
	});

	return c.json({
		success: true,
	});
});

const port = 3001;
console.log(`Server is running on http://localhost:${port}`);

serve({
	fetch: app.fetch,
	port,
});
