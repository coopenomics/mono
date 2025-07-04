"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomePayloadSchema = void 0;
const zod_1 = require("zod");
// Схема для welcome воркфлоу
exports.welcomePayloadSchema = zod_1.z.object({
    userName: zod_1.z.string(),
    userEmail: zod_1.z.string().email(),
    age: zod_1.z.number().optional(),
});
