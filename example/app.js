import { OnlineClient, isSupportWebWorker } from "../dist/hb-auth.mjs";

const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";
const MY_USER = "guest4test";

const client = new OnlineClient();

client.initialize().then(async (authClient) => {
  // display auth status
  const statusEl = document.getElementById("auth-status");
  const errorEl = document.getElementById("error");
  errorEl.style.color = "red";

  const updateStatus = async () => {
    errorEl.innerText = "";
    await authClient.getAuthByUser(MY_USER).then((auth) => {
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

  // fired when session ends or user logs out
  await authClient.setSessionEndCallback(async () => {
    await updateStatus();
  });

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
    authClient
      .authenticate(data.username, data.password, data.type)
      .then((status) => {
        if (status.ok) {
          updateStatus();
        } else {
          updateStatus();
          errorEl.innerText = "Not authorized: Invalid credentials";
        }
      })
      .catch((err) => {
        errorEl.innerText = err.message;
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

    authClient
      .register(data.username, data.password, data.key, data.type)
      .then((status) => {
        if (status.ok) {
          updateStatus();
        } else {
          updateStatus();
          errorEl.innerText = "Not authorized: Invalid credentials";
        }
      })
      .catch((err) => {
        errorEl.innerText = err.message;
      });
  };

  // handle logout
  document.getElementById("logout").onclick = async (event) => {
    await authClient.logout().then(() => {
      updateStatus();
    });
  };
});
