import { OfflineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const MY_USER = ""; // add your user name here for following it's status

// create new client instance
const client = new OfflineClient({sessionTimeout: 20});

let authClient = undefined;

// handle login form submit
const loginForm = document.getElementById("login-form");
const errorEl = document.getElementById("error");
errorEl.style.color = "red";

loginForm.onsubmit = (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  for (const [key, val] of formData.entries()) {
    data[key] = val;
  }
  console.log("form data ", data);

  if (!authClient) {
    return alert("Auth client is not initialized yet. Please wait a moment and try again.");
  }

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

// Initialize auth client first!
(async () => {
  const chain = await createHiveChain();
  authClient = await client.initialize(chain);

  // handle logout
  document.getElementById("logout").onclick = () => {
    authClient.logout().then(() => {
      updateStatus();
    });
  };

  // display auth status
  const statusEl = document.getElementById("auth-status");

  const updateStatus = async (user) => {
    errorEl.innerText = "";
    await authClient.getAuthByUser(user || MY_USER).then((auth) => {
      if (!auth) {
        statusEl.innerText = "There is no registered user";
        statusEl.style.color = "grey";
      } else {
        if (auth.authorized) {
          statusEl.innerHTML = `Authorized with username: <b>${auth.username}</b> and keyType: ${auth.loggedInKeyType}`;
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

  // handle registration form submit
  const registrationForm = document.getElementById("reg-form");

  registrationForm.onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = {};
    for (const [key, val] of formData.entries()) {
      data[key] = val;
    }

    const isStrict = data.strict === 'on'
    authClient
      .register(data.username, data.password, data.key, data.type, isStrict)
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
})();
