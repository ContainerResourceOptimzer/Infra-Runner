// src/app.ts

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import {grpcServiceHandlers} from "./grpc/client.js"

dotenv.config();

// ESM 환경에서 __dirname 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proto 파일 경로 설정
const PROTO_PATH = join(__dirname, "../proto/agent.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH, {});
const loadedProto: any = grpc.loadPackageDefinition(packageDef);
const runnerService = loadedProto.runner.RunnerAgent.service;

export function main() {
	const server = new grpc.Server();
	server.addService(runnerService, grpcServiceHandlers);

	const port = process.env.PORT || "50051";
	server.bindAsync(
		`0.0.0.0:${port}`,
		grpc.ServerCredentials.createInsecure(),
		(err, bindPort) => {
			if (err) {
				console.error("gRPC bind error:", err);
				return;
			}
			server.start();
			console.log(`Runner-Agent listening on port ${bindPort}`);
		}
	);
}

main();
