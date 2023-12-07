import { OnlineClient } from "@hive/hb-auth";

const CHAIN_ID =
  "beeab0de00000000000000000000000000000000000000000000000000000000";
const MY_USER = "add_your_test_username_here_to_check_auth_status";

// create new client instance
const client = new OnlineClient();

// Initialize auth client first!
client.initialize().then(async (authClient) => {
  // display auth status
  const statusEl = document.getElementById("auth-status");
  const errorEl = document.getElementById("error");
  errorEl.style.color = "red";

  const updateStatus = async (user) => {
    errorEl.innerText = "";
    await authClient.getAuthByUser(user || MY_USER).then((auth) => {
      if (!auth) {
        statusEl.innerText = "There is no registered user";
        statusEl.style.color = "grey";
      } else {
        if (auth.authorized) {
          statusEl.innerHTML = `Authorized with username: <b>${auth.username}</b> and keyType: ${auth.keyType}`;
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
          updateStatus(data.username);
        } else {
          updateStatus(data.username);
          errorEl.innerText = "Not authorized: Invalid credentials";
        }
      })
      .catch((err) => {
        console.log(err);
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
        console.log(err);
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
