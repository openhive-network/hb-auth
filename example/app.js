import { client, isSupportWebWorker } from "../dist/hb-auth.mjs";

console.log(isSupportWebWorker, client);

const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";

client.initialize({ chainId: CHAIN_ID }).then((authClient) => {
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
  authClient.authorize(data.username, data.password);
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
});

