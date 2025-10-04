import { exec } from "child_process";
import { promisify } from "util";

const MONITOR_COMPOSE_FILE = process.env.MONITOR_COMPOSE_FILE;
const DEFAULT_PROM_HOST = process.env.PROMETHEUS_HOST || "localhost";
const DEFAULT_PROM_PORT = process.env.PROMETHEUS_PORT || "9090";

const sh = promisify(exec);

async function checkMonitorHealthy(
	host: string,
	port: string
): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);
		const response = await fetch(`http://${host}:${port}/-/healthy`, {
			method: "GET",
			signal: controller.signal,
		});

		clearTimeout(timeout);
		return response.ok;
	} catch (_) {
		return false;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMonitor(
	host: string,
	port: string,
	retries = 5,
	delayMs = 2000
) {
	for (let attempt = 0; attempt < retries; attempt++) {
		if (await checkMonitorHealthy(host, port)) return true;
		await sleep(delayMs);
	}

	return false;
}

export const runMonitorHandler = async (call: any, callback: any) => {
	const composeFile = MONITOR_COMPOSE_FILE;
	if (!composeFile) {
		console.error("Error:", "MONITOR_COMPOSE_FILE is not defined.");
		callback(null, {
			success: false,
			message: "MONITOR_COMPOSE_FILE is not defined.",
		});
		return;
	}

	const host = DEFAULT_PROM_HOST;
	const port = DEFAULT_PROM_PORT;

	if (await checkMonitorHealthy(host, port)) {
		console.log("Monitoring stack already healthy.");
		callback(null, {
			success: true,
			message: "Monitoring stack is running.",
		});
		return;
	}

	const env: NodeJS.ProcessEnv = { ...process.env };
	try {
		console.log(
			`Run Monitor Container` + `docker compose -f ${composeFile} up -d`
		);
		await sh(`docker compose -f ${composeFile} up -d`, { env });
	} catch (err: any) {
		console.error("Error:", "Failed to launch monitoring compose stack.");
		callback(null, {
			success: false,
			message: "Failed to launch monitoring compose stack.",
		});
		return;
	}

	if (!(await waitForMonitor(host, port))) {
		console.error(
			"Error:",
			"Monitoring stack did not become healthy after launch."
		);
		callback(null, {
			success: false,
			message: "Monitoring stack did not become healthy after launch.",
		});
		return;
	}

	callback(null, {
		success: true,
		message: "Monitoring stack is running.",
	});
};
