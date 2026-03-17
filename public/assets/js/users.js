document.addEventListener("DOMContentLoaded", function () {
    const hasDesktopTable = !!document.getElementById("dataTable");
    const isMobile = () => window.innerWidth < 768;

    let table = null;
    if (hasDesktopTable) {
        table = $("#dataTable").DataTable({
            pageLength: 10,
            lengthMenu: [10, 25, 50, 100],
            order: [[0, "asc"]],
        });
    }

    const $mobileList = document.getElementById("usersMobileList");
    let usersCache = [];
    let editingId = null;

    const DEFAULT_PERMISSIONS = [
        "dashboard",
        "sales",
        "stock",
        "products",
        "invoicing",
        "customers",
        "suppliers",
        "reports",
        "settings",
        "users",
    ];

    function roleBadge(role) {
        if (role === "ADMIN") {
            return `<span class="badge badge-primary badge-role w-100">ADMIN</span>`;
        }
        return `<span class="badge badge-secondary badge-role w-100">USER</span>`;
    }

    function statusBadge(status) {
        if (status === "active") {
            return `<span class="badge badge-success badge-status w-100">Activo</span>`;
        }
        return `<span class="badge badge-danger badge-status w-100">Bloqueado</span>`;
    }

    function countPermissions(permissions = {}) {
        return DEFAULT_PERMISSIONS.filter((key) => !!permissions[key]).length;
    }

    function permissionsToObject(selector) {
        const obj = {};
        document.querySelectorAll(selector).forEach((el) => {
            obj[el.value] = el.checked;
        });
        return obj;
    }

    function setPermissions(selector, permissions = {}) {
        document.querySelectorAll(selector).forEach((el) => {
            el.checked = !!permissions[el.value];
        });
    }

    function setAllPermissions(selector, checked) {
        document.querySelectorAll(selector).forEach((el) => {
            el.checked = checked;
        });
    }

    function resetCreateForm() {
        const form = document.getElementById("create-user-form");
        if (form) form.reset();

        document.getElementById("user-name").value = "";
        document.getElementById("user-email").value = "";
        document.getElementById("user-contact").value = "";
        document.getElementById("user-role").value = "USER";
        setAllPermissions(".perm-create", true);
    }

    function renderMobile(users) {
        if (!$mobileList) return;

        if (!isMobile()) {
            $mobileList.innerHTML = "";
            return;
        }

        if (!users.length) {
            $mobileList.innerHTML = `<div class="text-center text-muted py-4">Sem utilizadores.</div>`;
            return;
        }

        $mobileList.innerHTML = users.map((u) => `
      <div class="u-card">
        <div class="u-top">
          <div>
            <div class="u-name">${u.name || "—"}</div>
            <div class="u-email">${u.email || "—"}</div>
          </div>
        </div>

        <div class="u-meta">
          <span class="u-pill"><i class="fa-solid fa-phone"></i> ${u.contact || "Sem contacto"}</span>
          <span class="u-pill"><i class="fa-solid fa-user-shield"></i> ${u.role || "USER"}</span>
          <span class="u-pill"><i class="fa-solid fa-key"></i> ${countPermissions(u.permissions)} permissões</span>
          <span class="u-pill"><i class="fa-solid fa-circle-info"></i> ${u.status === "active" ? "Activo" : "Bloqueado"}</span>
        </div>

        <div class="u-actions">
          <button class="btn btn-outline-primary btn-edit-user" data-id="${u._id}">
            <i class="fa-solid fa-pen-to-square"></i> Editar
          </button>
          <button class="btn btn-outline-${u.status === "active" ? "danger" : "success"} btn-toggle-status" data-id="${u._id}" data-status="${u.status}">
            <i class="fa-solid ${u.status === "active" ? "fa-user-slash" : "fa-user-check"}"></i>
            ${u.status === "active" ? "Bloquear" : "Activar"}
          </button>
        </div>
      </div>
    `).join("");
    }

    function clearAndFill(users) {
        usersCache = users || [];
        renderMobile(usersCache);

        if (!table) return;

        table.clear();

        usersCache.forEach((u) => {
            table.row.add([
                `
          <div class="table-user-name">${u.name || "—"}</div>
          <div class="table-user-email">${u.email || "—"}</div>
        `,
                `${u.contact || "—"}`,
                roleBadge(u.role),
                statusBadge(u.status),
                `<span class="badge badge-light">${countPermissions(u.permissions)} / ${DEFAULT_PERMISSIONS.length}</span>`,
                `
          <button class="btn btn-sm btn-outline-primary btn-edit-user" data-id="${u._id}" title="Editar">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-sm btn-outline-${u.status === "active" ? "danger" : "success"} btn-toggle-status"
            data-id="${u._id}" data-status="${u.status}" title="${u.status === "active" ? "Bloquear" : "Activar"}">
            <i class="fa-solid ${u.status === "active" ? "fa-user-slash" : "fa-user-check"}"></i>
          </button>
        `,
            ]);
        });

        table.draw(false);
    }

    async function loadUsers() {
        const res = await fetch("/api/users");
        const data = await res.json();

        if (data.status === "success") {
            clearAndFill(data.users || []);
        } else {
            Swal.fire({
                icon: "error",
                title: "Erro",
                text: data.message || "Não foi possível carregar utilizadores",
            });
        }
    }

    async function fetchUserById(id) {
        const res = await fetch(`/api/users/${id}`);
        const data = await res.json();
        if (data.status !== "success") {
            throw new Error(data.message || "Não foi possível carregar utilizador");
        }
        return data.user;
    }

    document.getElementById("btn-open-user-modal")?.addEventListener("click", function () {
        resetCreateForm();
        $("#createUserModal").modal("show");
    });

    document.getElementById("btn-check-all-create")?.addEventListener("click", function () {
        setAllPermissions(".perm-create", true);
    });

    document.getElementById("btn-uncheck-all-create")?.addEventListener("click", function () {
        setAllPermissions(".perm-create", false);
    });

    document.getElementById("btn-check-all-update")?.addEventListener("click", function () {
        setAllPermissions(".perm-update", true);
    });

    document.getElementById("btn-uncheck-all-update")?.addEventListener("click", function () {
        setAllPermissions(".perm-update", false);
    });

    document.getElementById("user-role")?.addEventListener("change", function () {
        const isAdmin = this.value === "ADMIN";
        setAllPermissions(".perm-create", isAdmin);
    });

    document.getElementById("user-role-update")?.addEventListener("change", function () {
        const isAdmin = this.value === "ADMIN";
        setAllPermissions(".perm-update", isAdmin);
    });

    document.getElementById("btn-create-user")?.addEventListener("click", async function () {
        const name = document.getElementById("user-name").value.trim();
        const email = document.getElementById("user-email").value.trim();
        const contact = document.getElementById("user-contact").value.trim();
        const role = document.getElementById("user-role").value;
        const permissions = permissionsToObject(".perm-create");

        if (!name || !email) {
            return Swal.fire({
                icon: "warning",
                title: "Campos obrigatórios",
                text: "Preencha nome e e-mail.",
            });
        }

        const payload = { name, email, contact, role, permissions };

        const resp = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const json = await resp.json().catch(() => ({}));

        if (!resp.ok || json.status !== "success") {
            return Swal.fire({
                icon: "error",
                title: "Erro",
                text: json.message || "Erro ao criar utilizador",
            });
        }

        $("#createUserModal").modal("hide");
        resetCreateForm();

        let successHtml = "Utilizador criado com sucesso.";
        if (json.temporaryPassword) {
            successHtml += `<br><br><strong>Senha temporária:</strong> <code>${json.temporaryPassword}</code>`;
        }

        Swal.fire({
            icon: "success",
            title: "Sucesso",
            html: successHtml,
        });
        await loadUsers();
    });

    document.addEventListener("click", async function (e) {
        const editBtn = e.target.closest(".btn-edit-user");
        if (editBtn) {
            try {
                editingId = editBtn.dataset.id;
                const u = await fetchUserById(editingId);

                document.getElementById("update-user-id").value = u._id;
                document.getElementById("user-name-update").value = u.name || "";
                document.getElementById("user-email-update").value = u.email || "";
                document.getElementById("user-contact-update").value = u.contact || "";
                document.getElementById("user-role-update").value = u.role || "USER";
                document.getElementById("user-status-update").value = u.status || "active";

                setPermissions(".perm-update", u.permissions || {});
                $("#updateUserModal").modal("show");
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Erro",
                    text: error.message || "Não foi possível carregar utilizador",
                });
            }
            return;
        }

        const toggleBtn = e.target.closest(".btn-toggle-status");
        if (toggleBtn) {
            const id = toggleBtn.dataset.id;
            const currentStatus = toggleBtn.dataset.status;
            const nextStatus = currentStatus === "active" ? "blocked" : "active";

            Swal.fire({
                title: nextStatus === "blocked" ? "Bloquear utilizador?" : "Activar utilizador?",
                text: nextStatus === "blocked"
                    ? "O utilizador deixará de conseguir entrar no sistema."
                    : "O utilizador poderá voltar a entrar no sistema.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: nextStatus === "blocked" ? "Sim, bloquear" : "Sim, activar",
                cancelButtonText: "Cancelar",
            }).then(async (r) => {
                if (!r.isConfirmed) return;

                const resp = await fetch(`/api/users/${id}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: nextStatus }),
                });

                const json = await resp.json().catch(() => ({}));

                if (!resp.ok || json.status !== "success") {
                    return Swal.fire({
                        icon: "error",
                        title: "Erro",
                        text: json.message || "Erro ao actualizar estado",
                    });
                }

                Swal.fire({
                    icon: "success",
                    title: "Sucesso",
                    text: nextStatus === "blocked" ? "Utilizador bloqueado" : "Utilizador activado",
                    timer: 1200,
                    showConfirmButton: false,
                });

                await loadUsers();
            });

            return;
        }
    });

    document.getElementById("btn-update-user")?.addEventListener("click", async function () {
        const id = document.getElementById("update-user-id").value || editingId;
        const name = document.getElementById("user-name-update").value.trim();
        const email = document.getElementById("user-email-update").value.trim();
        const contact = document.getElementById("user-contact-update").value.trim();
        const role = document.getElementById("user-role-update").value;
        const status = document.getElementById("user-status-update").value;
        const permissions = permissionsToObject(".perm-update");

        if (!id) return;
        if (!name || !email) {
            return Swal.fire({
                icon: "warning",
                title: "Campos obrigatórios",
                text: "Preencha nome e e-mail.",
            });
        }

        const resp = await fetch(`/api/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, contact, role, status, permissions }),
        });

        const json = await resp.json().catch(() => ({}));

        if (!resp.ok || json.status !== "success") {
            return Swal.fire({
                icon: "error",
                title: "Erro",
                text: json.message || "Erro ao actualizar utilizador",
            });
        }

        $("#updateUserModal").modal("hide");

        Swal.fire({
            icon: "success",
            title: "Sucesso",
            text: "Utilizador actualizado com sucesso",
            timer: 1200,
            showConfirmButton: false,
        });

        await loadUsers();
    });

    $("#createUserModal").on("hidden.bs.modal", function () {
        resetCreateForm();
    });

    window.addEventListener("resize", function () {
        renderMobile(usersCache);
    });

    loadUsers().catch((err) => {
        console.error(err);
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Falha ao carregar utilizadores",
        });
    });
});