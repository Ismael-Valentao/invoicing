async function getClientsOptions() {
    const response = await fetch('/api/clients');
    const data = await response.json();

    if (data.status === "success" && data.clients.length > 0) {
        return data.clients
            .map(client => `<option value="${client._id}">${client.name}</option>`)
            .join('');
    }

    return '';
}
