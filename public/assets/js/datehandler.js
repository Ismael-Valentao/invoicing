document.addEventListener("DOMContentLoaded", function(){
    const date = new Date()
    const year = date.getFullYear();
    document.getElementById("copyright-year").innerText = year;
})