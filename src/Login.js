
let Api = require('./Api');
let Password = require('./Password');
let UserSettings = require('./UserSettings');

async function loginOrAddUserAsync(args) {

  // Default to `client` since xde is a client
  args.type = args.type || 'client';

  if (!args.username || !args.password) {
    throw new Error("Both `username` and `password` are required to login or add a new user");
  }

  let hashedPassword = Password.hashPassword(args.password);

  let data = Object.assign({}, args, {hashedPassword});
  delete data.password;

  // console.log("data=", data);

  let result = await Api.callMethodAsync('adduser', data);
  // console.log("result=", result);
  if (result.user) {
    delete result.type;
    // console.log("Login as", result);
    await UserSettings.mergeAsync(result.user);
    return result;
  } else {
    return null;
  }

}

async function logoutAsync() {
  let result = await Api.callMethodAsync('logout', []);
  UserSettings.deleteKeyAsync('username');
}

module.exports = {
  loginOrAddUserAsync,
  logoutAsync,
};
