//Login function
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (email.trim() === "" || password.trim() === "") {
        alert("Preencha os campos de login!!!");
        return;
    }

    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (data.success) {
        window.location.href = '/dashboard';
    } else {
        alert(data.message);
    }

}

// Event listener for the login button
document.querySelector('.btn-user').addEventListener('click', function (event) {
    event.preventDefault(); // Prevent the default form submission
    login(); // Call the login function
});