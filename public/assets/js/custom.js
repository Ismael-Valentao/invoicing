document.addEventListener("DOMContentLoaded", function(e){
    document.getElementById("companyName").addEventListener("input", function(e){
        const value = this.value;

        document.getElementById("clientName").value = value;
    })
})