import { client, isSupportWebWorker } from "@hiveio/hb-auth";

console.log(isSupportWebWorker, client);

const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";
const PASS = "PW5Juu68BCzH6sXo2LzFM5DCa1EE5Vi6a2m1C8c41pW9WbB2h9tg1";
const MY_KEY = "5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT";
const MY_PUB = "5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh";

let authClient;

client.initialize({ chainId: CHAIN_ID }).then((cli) => {
  authClient = cli;
});

// display auth status
const statusEl = document.getElementById("auth-status");

// handle login form submit
const loginForm = document.getElementById("login-form");

loginForm.onsubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  for (const [key, val] of formData.entries()) {
    data[key] = val;
  }
  console.log("form data ", data);
  authClient.login(data.username, data.password);
};


// handle registration form submit
const registrationForm = document.getElementById("reg-form");

registrationForm.onsubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  for (const [key, val] of formData.entries()) {
    data[key] = val;
  }
  console.log("form data ", data);
  authClient.register(data.password, data.key, data.type, data.username);
};


// handle logout
document.getElementById('logout').onclick = async (event) => {
  console.log(await authClient.logout());
}