import http from "k6/http";
import { check, sleep } from "k6";

/* 테스트 통과 조건
	- 요청 응답 시간 95%가 {__ENV.HTTP_REQ_DURATION}초 이내
	- 총 {__ENV.HTTP_REQ_DURATION}건 이상 요청 발생
	- 실패율 5% 미만
*/
export const options = {
	stages: [
		{ duration: "30s", target: 50 }, // 30초 동안 사용자를 100명까지 늘립니다 (Ramp-up)
		{ duration: "30s", target: 100 }, // 1분 동안 사용자 100명을 유지합니다 (Sustained Load)
		{ duration: "10s", target: 0 }, // 30초 동안 사용자를 0명으로 줄입니다 (Ramp-down)
	],
	thresholds: {
		http_req_duration: [`p(95)<=${__ENV.HTTP_REQ_DURATION}`],
		http_reqs: [`count>=${__ENV.HTTP_REQS}`],
		http_req_failed: ["rate<5.0"],
	},
	tags: {
		experiment: __ENV.EXP_ID,
		container: __ENV.JOB_ID,
	},
};

const BASE_URL = "http://api:3000";
const REQ_TIMEOUT = __ENV.HTTP_TIMEOUT || "120s";

export function setup() {
	for (let i = 0; i < 30; i++) {
		const r = http.get(`${BASE_URL}/api/health`, { timeout: "5s" });
		if (r.status === 200) return;
		sleep(1);
	}
	throw new Error("API not ready after 30s");
}

export default function () {
	// GET /api/users
	const res1 = http.get(`${BASE_URL}/api/users`, {
		tags: { name: "users-test" },
		timeout: REQ_TIMEOUT,
	});
	check(res1, { "GET /api/users 200": (res) => res.status === 200 });

	// GET /api/boards
	const res2 = http.get(`${BASE_URL}/api/boards`, {
		tags: { name: "boards-test" },
		timeout: REQ_TIMEOUT,
	});
	check(res2, {
		"GET /api/boards is 200": (res) => res.status === 200,
	});

	// GET /api/comments
	const res3 = http.get(`${BASE_URL}/api/comments`, {
		tags: { name: "comments-test" },
		timeout: REQ_TIMEOUT,
	});
	check(res3, {
		"GET /api/comments is 200": (res) => res.status === 200,
	});

	// GET /api/memory-test
	const res4 = http.get(`${BASE_URL}/api/memory-test?size=100`, {
		tags: { name: "memory-test" }, // ← 쿼리파라미터가 달라도 한 버킷으로 모임
		timeout: REQ_TIMEOUT,
	});
	check(res4, {
		"Memory test: status is 200": (res) => res.status === 200,
	});

	sleep(1);
}
