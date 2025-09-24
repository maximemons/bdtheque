const auth = firebase.auth();
const db = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
  if(!user) {
    window.location.href = "../index.html";
  } else {
    const userPreferences = await getElement(CollectionsName.Preferences, user.email);
    if(userPreferences == undefined) {
    }else {
      document.getElementById("userName").innerText = getDisplayName(userPreferences.self, user.email);
      document.getElementById("userEmail").innerText = user.email;
      
      const avatar = userPreferences?.self?.avatar?.trim();
      if (avatar) {
        const userAvatar = document.getElementById("userAvatar");
        userAvatar.insertAdjacentHTML("beforeend", `
          <div class="avatar-cover">
            <img src="${avatar}" alt="User avatar">
          </div>
        `);
      }else {
        document.getElementById("userAvatar").innerText = getDisplayName(userPreferences.self, user.email).charAt(0).toUpperCase();
      }
    }
  }
});

function logout() {
  auth.signOut().then(() => window.location.href = "../login.html");
}

function getDisplayName(user, email) {
  const firstName = user.firstname?.trim();
  const lastName = user.lastname?.trim();

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else {
    return email.split('@')[0];
  }
}





