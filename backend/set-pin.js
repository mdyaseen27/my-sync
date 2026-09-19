
// Run this script with your actual Supabase URL and key
import argon2 from "argon2";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const pin = "823756";
const salt = randomBytes(16).toString("hex");
const hash = await argon2.hash(pin + salt, { type: argon2.argon2id, memoryCost: 2**16, timeCost: 3, parallelism: 1 });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data, error } = await supabase.from("pins").upsert({ hash, salt, created_at: new Date().toISOString() }).select().single();
console.log(error ? "ERROR: " + error.message : "SUCCESS: PIN set to 823756");

