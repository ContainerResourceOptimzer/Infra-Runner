// src/app.ts

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const sh = promisify(exec);

dotenv.config();

// ESM 환경에서 __dirname 정의
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proto 파일 경로 설정
const PROTO_PATH = join(__dirname, "./proto/agent.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH, {});
const loadedProto: any = grpc.loadPackageDefinition(packageDef);
const runnerService = loadedProto.runner.RunnerAgent.service;

let apiPort: number = 3000;

const handlers = {
	runExperiment: async (call: any, callback: any) => {
		const { jobId, cpu, mem } = call.request;
		const env: NodeJS.ProcessEnv = {
			...process.env,
			CPU: cpu,
			MEM: mem,
			API_PORT: (++apiPort).toString(),
		};

		console.log(
			`Run Experiment [${jobId} (${cpu}, ${mem}) PORT: ${apiPort - 1}]`
		);
		const compose = (cmd: string) =>
			sh(
				`docker compose --compatibility -f ${process.env.DEFAULT_COMPOSE_FILE} -p ${jobId} ${cmd}`,
				{ env }
			);

		try {
			// 1) detached up
			await compose("up -d");

			// 2) k6 컨테이너 ID 얻어서 wait
			const { stdout: id } = await compose("ps -q k6");
			const { stdout: code } = await sh(`docker wait ${id.trim()}`);
			const exitCode = parseInt(code, 10);

			// 3) 테스트 끝났으니 스택 정리
			await compose("down -v");
			console.log(`[${jobId}] stack cleaned up`);

			callback(null, {
				success: exitCode === 0,
				message: `Experiment [${jobId} (${cpu}, ${mem}) PORT: ${apiPort}] started`,
			});
		} catch (e: any) {
			console.error(`Experiment ${jobId} error:`, e.stderr || e.message);
		}
	},
};

export function main() {
	const server = new grpc.Server();
	server.addService(runnerService, handlers);

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
