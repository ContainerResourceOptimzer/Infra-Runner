import http from "k6/http";
import { check, sleep } from "k6";
import type { Options } from "k6/options";

/* 테스트 통과 조건
	- 요청 응답 시간 95%가 3초 이내
	- 총 3000건 이상 요청 발생
	- 실패율 1% 미만
*/
export const options: Options = {
	vus: 1500,
	duration: "1m",
	thresholds: {
		http_req_duration: ["p(95)<=3000"],
		http_reqs: ["count>=55555"],
		http_req_failed: ["rate<5.0"],
	},
	tags: {
		experiment: __ENV.EXP_ID,
		container: __ENV.JOB_ID,
	},
};

let userId = 1,
	boardId = 1;

const BASE_URL = "http://api:3000";

export default function () {
	// // GET /users/1
	// const userDetailRes = http.get(
	// 	`${BASE_URL}/users/${Math.floor(Math.random() * 10000)}`
	// );
	// check(userDetailRes, { "GET /users/1 is 200": (res) => res.status === 200 });

	// // GET /boards/1
	// const boardDetailRes = http.get(
	// 	`${BASE_URL}/boards/${Math.floor(Math.random() * 10000)}`
	// );
	// check(boardDetailRes, {
	// 	"GET /boards/1 is 200": (res) => res.status === 200,
	// });

	// // GET /comments/1
	// const commentDetailRes = http.get(
	// 	`${BASE_URL}/comments/${Math.floor(Math.random() * 10000)}`
	// );
	// check(commentDetailRes, {
	// 	"GET /comments/1 is 200": (res) => res.status === 200,
	// });

	// POST /users
	const newUser = {
		name: `테스트${Math.random().toString(36).substring(2, 5)}`,
		email: `user${Math.floor(Math.random() * 10000)}@test.com`,
		phone: "010-1234-5678",
	};
	const createUserRes = http.post(
		`${BASE_URL}/users`,
		JSON.stringify(newUser),
		{
			headers: { "Content-Type": "application/json" },
		}
	);
	check(createUserRes, { "POST /users is 201": (res) => res.status === 201 });

	// POST /boards
	const newBoard = {
		title: "부하 테스트 게시글",
		content: "본문 내용입니다",
		authorId: userId,
	};
	const createBoardRes = http.post(
		`${BASE_URL}/boards`,
		JSON.stringify(newBoard),
		{
			headers: { "Content-Type": "application/json" },
		}
	);
	check(createBoardRes, { "POST /boards is 201": (res) => res.status === 201 });

	// POST /comment
	const newComment = {
		boardId: boardId++,
		authorId: userId++,
		content: "본문 내용입니다",
		rating: 3,
	};
	const createCommentRes = http.post(
		`${BASE_URL}/comments`,
		JSON.stringify(newComment),
		{
			headers: { "Content-Type": "application/json" },
		}
	);
	check(createCommentRes, {
		"POST /comments is 201": (res) => res.status === 201,
	});

	sleep(1);
}
