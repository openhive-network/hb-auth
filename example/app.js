import { client, isSupportWebWorker } from "../dist/hb-auth.mjs";

console.log(isSupportWebWorker, client);

const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";

client
  .initialize({
    chainId: CHAIN_ID
  })
.then(async (authClient) => {
    // display auth status
    const statusEl = document.getElementById("auth-status");

    const updateStatus = async () => {
      await authClient.getCurrentAuth().then((auth) => {
        if (!auth) {
          statusEl.innerText = "There is no registered user";
          statusEl.style.color = "grey";
        } else {
          console.log(auth);
          if (auth.authorized) {
            statusEl.innerHTML = `Authorized with username: <b>${auth.username}</b>`;
            statusEl.style.color = "green";
          } else {
            statusEl.innerHTML = `User: <b>${auth.username}</b> requires authorization`;
            statusEl.style.color = "red";
          }
        }
      });
    };

    // get initial status
    await updateStatus();

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
      authClient.authorize(data.username, data.password).then(() => {
        updateStatus();
      });
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
      authClient
        .register(data.password, data.key, data.type, data.username)
        .then(() => {
          updateStatus();
        });
    };

    // handle logout
    document.getElementById("logout").onclick = async (event) => {
      await authClient.logout().then(() => {
        updateStatus();
      });
    };
  });
