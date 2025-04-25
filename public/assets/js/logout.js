function logout() {
    fetch("/auth/logout", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "include"
    })
        .then(response => {
            if (response.ok) {
                window.location.href = "/login";
            } else {
                window.location.href = "/login";
            }
        })
        .catch(error => {
            console.error("Erro:", error);
        });
}