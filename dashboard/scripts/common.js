function displayHamburgerMenu() {
  let sidebar = document.getElementById("sidebar");
  const classname = "open";
  
  if(sidebar.classList.contains(classname)) {
    sidebar.classList.remove(classname);
  }else {
    sidebar.classList.add(classname);
  }
}