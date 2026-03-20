document.addEventListener("DOMContentLoaded", function () {
  let companyCache = null;
  let logoPreviewObjectUrl = null;
  let bankVisibilitySaveTimer = null;

  const els = {
    companyName: document.getElementById("companyName"),
    companyNUIT: document.getElementById("companyNUIT"),
    companyContact: document.getElementById("companyContact"),
    companyEmail: document.getElementById("companyEmail"),
    companyAddress: document.getElementById("companyAddress"),

    companyNameView: document.getElementById("companyNameView"),
    companyNUITView: document.getElementById("companyNUITView"),
    companyContactView: document.getElementById("companyContactView"),
    companyEmailView: document.getElementById("companyEmailView"),
    companyAddressView: document.getElementById("companyAddressView"),

    btnEditCompanyInfo: document.getElementById("btn-edit-company-info"),
    companyForm: document.getElementById("companyForm"),
    companyNameModal: document.getElementById("companyNameModal"),
    companyNUITModal: document.getElementById("companyNUITModal"),
    companyContactModal: document.getElementById("companyContactModal"),
    companyEmailModal: document.getElementById("companyEmailModal"),
    companyAddressModal: document.getElementById("companyAddressModal"),
    btnUpdateCompany: document.getElementById("btn-update-company"),

    bankEmptyState: document.getElementById("bank-empty-state"),
    bankListSection: document.getElementById("bank-list-section"),
    bankAccountsList: document.getElementById("bankAccountsList"),
    btnOpenBankModal: document.getElementById("btn-open-modalbankInfo"),

    bankForm: document.getElementById("bank_account_form"),
    editingBankId: document.getElementById("editingBankId"),
    bankModalTitle: document.getElementById("bank-modal-title"),
    bankLabelModal: document.getElementById("bankLabelModal"),
    companyBankModal: document.getElementById("companyBankModal"),
    companyBankOtherWrap: document.getElementById("companyBankOtherWrap"),
    companyBankOtherModal: document.getElementById("companyBankOtherModal"),
    modalBankUserName: document.getElementById("modal_bank_user_name"),
    modalBankNumAccount: document.getElementById("modal_bank_num_account"),
    modalBankNib: document.getElementById("modal_bank_nib"),
    modalBankNuib: document.getElementById("modal_bank_nuib"),
    bankIsPrimaryModal: document.getElementById("bankIsPrimaryModal"),
    btnSaveBankAccount: document.getElementById("btn-save-bankaccount"),

    showInvoices: document.getElementById("showInvoices"),
    showQuotations: document.getElementById("showQuotations"),
    showVds: document.getElementById("showVds"),

    inputLogo: document.getElementById("input-logo"),
    btnAddLogo: document.getElementById("btn-add-logo"),
    companyLogoPreview: document.getElementById("company_logo_preview"),
    logoPreview: document.getElementById("logo_preview"),
    btnSaveLogo: document.getElementById("btn-save-logo"),

    activeModuleLabel: document.getElementById("active-module-label"),
    activeModuleHint: document.getElementById("active-module-hint"),
    activeModuleBadge: document.getElementById("active-module-badge"),
    currentModuleText: document.getElementById("current-module-text"),
    modSalesCheckbox: document.getElementById("modSalesCheckbox"),
    modInvoicingCheckbox: document.getElementById("modInvoicingCheckbox"),
    btnSaveModule: document.getElementById("btn-save-module"),
    moduleSalesOption: document.getElementById("module-option-sales"),
    moduleInvoicingOption: document.getElementById("module-option-invoicing"),
  };

  function setButtonLoading(button, isLoading, loadingText = "Salvando...") {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm mr-1"></span>${loadingText}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
      }
    }
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value && String(value).trim() ? value : "—";
  }

  function setInputValue(el, value) {
    if (!el) return;
    el.value = value ?? "";
  }

  function showToast(icon, title) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true
    });
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function clearValidation(form) {
    if (!form) return;
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  }

  function invalidateField(field) {
    if (field) field.classList.add("is-invalid");
  }

  function getSelectedBankName() {
    const bank = els.companyBankModal.value;
    if (bank === "Outro") {
      return els.companyBankOtherModal.value.trim();
    }
    return bank;
  }

  function handleOtherBankVisibility() {
    const isOther = els.companyBankModal.value === "Outro";
    els.companyBankOtherWrap.classList.toggle("d-none", !isOther);
    if (!isOther) {
      els.companyBankOtherModal.value = "";
      els.companyBankOtherModal.classList.remove("is-invalid");
    }
  }

  function fillCompanySection(company) {
    setInputValue(els.companyName, company.name);
    setInputValue(els.companyNUIT, company.nuit);
    setInputValue(els.companyContact, company.contact);
    setInputValue(els.companyEmail, company.email);
    setInputValue(els.companyAddress, company.address);

    setText(els.companyNameView, company.name);
    setText(els.companyNUITView, company.nuit);
    setText(els.companyContactView, company.contact);
    setText(els.companyEmailView, company.email);
    setText(els.companyAddressView, company.address);
  }

  function renderBankCards(bankDetails = []) {
    const banks = Array.isArray(bankDetails) ? bankDetails : [];

    els.bankEmptyState.classList.toggle("d-none", banks.length > 0);
    els.bankListSection.classList.toggle("d-none", banks.length === 0);

    if (!banks.length) {
      els.bankAccountsList.innerHTML = "";
      return;
    }

    els.bankAccountsList.innerHTML = banks.map((bank) => `
      <div class="col-md-6 mb-3">
        <div class="bank-card">
          <div class="bank-card-header">
            <div>
              <div class="bank-card-title">${bank.label?.trim() || bank.bank || "Conta bancária"}</div>
              <div class="bank-card-subtitle">${bank.bank || "—"}</div>
            </div>
            ${bank.isPrimary ? `<span class="bank-badge-primary">Principal</span>` : ""}
          </div>

          <div class="bank-meta">
            <div class="bank-meta-item">
              <div class="bank-meta-label">Proprietário</div>
              <div class="bank-meta-value">${bank.account_name || "—"}</div>
            </div>

            <div class="bank-meta-item">
              <div class="bank-meta-label">Conta</div>
              <div class="bank-meta-value">${bank.account_number || "—"}</div>
            </div>

            <div class="bank-meta-item">
              <div class="bank-meta-label">NIB</div>
              <div class="bank-meta-value">${bank.nib || "—"}</div>
            </div>

            <div class="bank-meta-item">
              <div class="bank-meta-label">NUIB</div>
              <div class="bank-meta-value">${bank.nuib || "—"}</div>
            </div>
          </div>

          <div class="bank-actions">
            <button type="button" class="btn btn-outline-primary btn-sm btn-edit-bank" data-id="${bank._id}">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>

            ${!bank.isPrimary ? `
              <button type="button" class="btn btn-outline-success btn-sm btn-set-primary-bank" data-id="${bank._id}">
                <i class="fa-solid fa-star"></i> Tornar principal
              </button>
            ` : ""}

            <button type="button" class="btn btn-outline-danger btn-sm btn-delete-bank" data-id="${bank._id}">
              <i class="fa-solid fa-trash"></i> Remover
            </button>
          </div>
        </div>
      </div>
    `).join("");
  }

  function fillBankVisibility(showBankDetails = {}) {
    els.showInvoices.checked = !!showBankDetails.invoices;
    els.showQuotations.checked = !!showBankDetails.quotations;
    els.showVds.checked = !!showBankDetails.vds;
  }

  function fillModuleSection(modules = {}) {
    const activeModules = [];

    if (modules.sales) activeModules.push("Vendas");
    if (modules.invoicing) activeModules.push("Facturação");

    if (!activeModules.length) {
      els.activeModuleLabel.textContent = "Nenhum";
      els.activeModuleHint.textContent = "Selecione pelo menos um módulo para começar a usar o sistema.";
      els.activeModuleBadge.className = "badge badge-warning";
      els.activeModuleBadge.textContent = "Sem módulo";
      els.currentModuleText.textContent = "Nenhum";

      els.modSalesCheckbox.checked = false;
      els.modInvoicingCheckbox.checked = false;

      updateModuleOptionStyles();
      return;
    }

    els.activeModuleLabel.textContent = activeModules.join(" + ");

    if (modules.sales && modules.invoicing) {
      els.activeModuleHint.textContent = "A conta está configurada com Vendas e Facturação.";
    } else if (modules.sales) {
      els.activeModuleHint.textContent = "Recibos + stock ligado ao caixa.";
    } else if (modules.invoicing) {
      els.activeModuleHint.textContent = "Facturas, VD, cotações e recibos.";
    }

    els.currentModuleText.textContent = activeModules.join(" + ");
    const totalActive = [modules.sales, modules.invoicing].filter(Boolean).length;
    els.activeModuleBadge.className = "badge badge-success";
    els.activeModuleBadge.textContent = totalActive === 2 ? "2 módulos" : "1 módulo";

    els.modSalesCheckbox.checked = !!modules.sales;
    els.modInvoicingCheckbox.checked = !!modules.invoicing;

    updateModuleOptionStyles();
  }

  function fillLogoSection(company) {
    const hasLogo = !!company.logoUrl;
    els.companyLogoPreview.src = hasLogo
      ? `https://bitiray.com/public/invoicing-logos/${company.logoUrl}`
      : "images/invoicing-logo-simple.png";
  }

  function updateModuleOptionStyles() {
    els.moduleSalesOption.classList.toggle("active", els.modSalesCheckbox.checked);
    els.moduleInvoicingOption.classList.toggle("active", els.modInvoicingCheckbox.checked);
  }

  function populateCompanyModal() {
    els.companyNameModal.value = els.companyName.value || "";
    els.companyNUITModal.value = els.companyNUIT.value || "";
    els.companyContactModal.value = els.companyContact.value || "";
    els.companyEmailModal.value = els.companyEmail.value || "";
    els.companyAddressModal.value = els.companyAddress.value || "";
    clearValidation(els.companyForm);
  }

  function resetBankModal() {
    clearValidation(els.bankForm);
    els.editingBankId.value = "";
    els.bankModalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Adicionar Conta Bancária`;
    els.bankLabelModal.value = "";
    els.companyBankModal.value = "BIM";
    els.companyBankOtherModal.value = "";
    els.modalBankUserName.value = "";
    els.modalBankNumAccount.value = "";
    els.modalBankNib.value = "";
    els.modalBankNuib.value = "";
    els.bankIsPrimaryModal.checked = !Array.isArray(companyCache?.bankDetails) || companyCache.bankDetails.length === 0;
    handleOtherBankVisibility();
  }

  function populateBankModalForEdit(bankId) {
    const bank = (companyCache?.bankDetails || []).find(item => String(item._id) === String(bankId));
    if (!bank) return;

    clearValidation(els.bankForm);
    els.editingBankId.value = bank._id;
    els.bankModalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Editar Conta Bancária`;
    els.bankLabelModal.value = bank.label || "";

    let found = false;
    for (let i = 0; i < els.companyBankModal.options.length; i++) {
      if (els.companyBankModal.options[i].value === bank.bank) {
        els.companyBankModal.selectedIndex = i;
        found = true;
        break;
      }
    }

    if (!found) {
      els.companyBankModal.value = "Outro";
      els.companyBankOtherModal.value = bank.bank || "";
    } else {
      els.companyBankOtherModal.value = "";
    }

    handleOtherBankVisibility();

    els.modalBankUserName.value = bank.account_name || "";
    els.modalBankNumAccount.value = bank.account_number || "";
    els.modalBankNib.value = bank.nib || "";
    els.modalBankNuib.value = bank.nuib || "";
    els.bankIsPrimaryModal.checked = !!bank.isPrimary;

    $("#bank_account_modal").modal("show");
  }

  function validateCompanyForm() {
    clearValidation(els.companyForm);
    let isValid = true;

    if (!els.companyNUITModal.value.trim()) {
      invalidateField(els.companyNUITModal);
      isValid = false;
    }

    if (!els.companyContactModal.value.trim()) {
      invalidateField(els.companyContactModal);
      isValid = false;
    }

    const email = els.companyEmailModal.value.trim();
    if (!email || !validateEmail(email)) {
      invalidateField(els.companyEmailModal);
      isValid = false;
    }

    if (!els.companyAddressModal.value.trim()) {
      invalidateField(els.companyAddressModal);
      isValid = false;
    }

    return isValid;
  }

  function validateBankForm() {
    clearValidation(els.bankForm);
    let isValid = true;

    if (!els.companyBankModal.value) {
      invalidateField(els.companyBankModal);
      isValid = false;
    }

    if (els.companyBankModal.value === "Outro" && !els.companyBankOtherModal.value.trim()) {
      invalidateField(els.companyBankOtherModal);
      isValid = false;
    }

    if (!els.modalBankUserName.value.trim()) {
      invalidateField(els.modalBankUserName);
      isValid = false;
    }

    if (!els.modalBankNumAccount.value.trim()) {
      invalidateField(els.modalBankNumAccount);
      isValid = false;
    }

    if (!els.modalBankNib.value.trim()) {
      invalidateField(els.modalBankNib);
      isValid = false;
    }

    return isValid;
  }

  async function fetchCompany() {
    const response = await fetch("/api/company/company");
    const data = await response.json();

    if (!response.ok || data.status !== "success") {
      throw new Error(data.message || "Erro ao obter dados da empresa");
    }

    companyCache = data.company;
    return companyCache;
  }

  function renderCompany(company) {
    fillCompanySection(company);
    renderBankCards(company.bankDetails || []);
    fillBankVisibility(company.showBankDetails || {});
    fillModuleSection(company.modules || {});
    fillLogoSection(company);
  }

  async function loadCompanyInfo() {
    const company = await fetchCompany();
    renderCompany(company);
  }

  async function updateCompanyInfo() {
    if (!validateCompanyForm()) {
      return Swal.fire({
        icon: "warning",
        title: "Dados inválidos",
        text: "Preencha correctamente os campos obrigatórios."
      });
    }

    setButtonLoading(els.btnUpdateCompany, true, "A actualizar...");

    try {
      const payload = {
        companyName: els.companyNameModal.value.trim(),
        companyNUIT: els.companyNUITModal.value.trim(),
        companyContact: els.companyContactModal.value.trim(),
        companyEmail: els.companyEmailModal.value.trim(),
        companyAddress: els.companyAddressModal.value.trim()
      };

      const response = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Erro ao actualizar os dados da empresa.");
      }

      if (companyCache) {
        companyCache.name = payload.companyName;
        companyCache.nuit = payload.companyNUIT;
        companyCache.contact = payload.companyContact;
        companyCache.email = payload.companyEmail;
        companyCache.address = payload.companyAddress;
        renderCompany(companyCache);
      }

      $("#companyModal").modal("hide");
      Swal.fire({
        icon: "success",
        text: "Dados da empresa actualizados com sucesso!",
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        text: error.message || "Erro ao actualizar os dados da empresa.",
        showConfirmButton: true
      });
    } finally {
      setButtonLoading(els.btnUpdateCompany, false);
    }
  }

  async function saveBankInfo() {
    if (!validateBankForm()) {
      return Swal.fire({
        icon: "warning",
        title: "Dados inválidos",
        text: "Preencha correctamente os campos obrigatórios."
      });
    }

    setButtonLoading(els.btnSaveBankAccount, true, "A guardar...");

    try {
      const editingBankId = els.editingBankId.value.trim();

      const bankDetails = {
        label: els.bankLabelModal.value.trim(),
        bank: getSelectedBankName(),
        account_name: els.modalBankUserName.value.trim(),
        account_number: els.modalBankNumAccount.value.trim(),
        nib: els.modalBankNib.value.trim(),
        nuib: els.modalBankNuib.value.trim(),
        isPrimary: els.bankIsPrimaryModal.checked
      };

      const isEdit = !!editingBankId;
      const url = isEdit ? `/api/company/banks/${editingBankId}` : "/api/company/banks";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankDetails })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Erro ao guardar dados bancários");
      }

      if (companyCache) {
        companyCache.bankDetails = data.bankDetails || [];
        renderCompany(companyCache);
      }

      $("#bank_account_modal").modal("hide");

      Swal.fire({
        icon: "success",
        title: "Sucesso!",
        text: isEdit ? "Conta bancária actualizada com sucesso." : "Conta bancária adicionada com sucesso.",
        showConfirmButton: true
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro!",
        text: error.message || "Erro ao guardar conta bancária.",
        showConfirmButton: true
      });
    } finally {
      setButtonLoading(els.btnSaveBankAccount, false);
    }
  }

  async function deleteBank(bankId) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Remover conta bancária?",
      text: "Esta ação não poderá ser desfeita.",
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch(`/api/company/banks/${bankId}`, {
        method: "DELETE"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Erro ao remover conta bancária");
      }

      if (companyCache) {
        companyCache.bankDetails = data.bankDetails || [];
        renderCompany(companyCache);
      }

      showToast("success", "Conta removida");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: error.message || "Erro ao remover conta bancária."
      });
    }
  }

  async function setPrimaryBank(bankId) {
    try {
      const response = await fetch(`/api/company/banks/${bankId}/primary`, {
        method: "PATCH"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Erro ao definir conta principal");
      }

      if (companyCache) {
        companyCache.bankDetails = data.bankDetails || [];
        renderCompany(companyCache);
      }

      showToast("success", "Conta principal actualizada");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: error.message || "Erro ao definir conta principal."
      });
    }
  }

  async function updateBankVisibility() {
    const showBankDetails = {
      invoices: els.showInvoices.checked,
      quotations: els.showQuotations.checked,
      vds: els.showVds.checked
    };

    try {
      const response = await fetch("/api/company/update-bank-visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showBankDetails })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Erro ao actualizar visibilidade");
      }

      if (companyCache) {
        companyCache.showBankDetails = showBankDetails;
      }

      showToast("success", "Visibilidade actualizada");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: error.message || "Erro ao actualizar visibilidade dos dados bancários."
      });

      if (companyCache) {
        fillBankVisibility(companyCache.showBankDetails || {});
      }
    }
  }

  async function updateModule() {
    const sales = !!els.modSalesCheckbox.checked;
    const invoicing = !!els.modInvoicingCheckbox.checked;

    if (!sales && !invoicing) {
      return Swal.fire({
        icon: "warning",
        title: "Selecione pelo menos um módulo",
        text: "Escolha Vendas, Facturação ou ambos."
      });
    }

    const currentSales = !!companyCache?.modules?.sales;
    const currentInvoicing = !!companyCache?.modules?.invoicing;

    if (sales === currentSales && invoicing === currentInvoicing) {
      return Swal.fire({
        icon: "info",
        title: "Sem alterações",
        text: "Os módulos selecionados já estão ativos."
      });
    }

    setButtonLoading(els.btnSaveModule, true, "A guardar...");

    try {
      const response = await fetch("/api/company/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sales, invoicing })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "success") {
        throw new Error(data.message || "Não foi possível actualizar.");
      }

      if (companyCache) {
        companyCache.modules = {
          ...companyCache.modules,
          sales,
          invoicing
        };
        renderCompany(companyCache);
      }

      $("#moduleModal").modal("hide");

      Swal.fire({
        icon: "success",
        title: "Pronto!",
        text: "Módulos actualizados com sucesso.",
        timer: 1200,
        showConfirmButton: false
      });
      setTimeout(()=>{
        location.reload()
      }, 2000)
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro",
        text: error.message || "Não foi possível actualizar."
      });
    } finally {
      setButtonLoading(els.btnSaveModule, false);
    }
  }

  async function updateLogoUrl(url) {
    const response = await fetch("/api/company/logo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ logo_name: url })
    });

    return response.json();
  }

  async function uploadLogo() {
    if (!els.inputLogo.files[0]) return;

    setButtonLoading(els.btnSaveLogo, true, "A carregar...");

    try {
      const file = els.inputLogo.files[0];
      const maxSizeMb = 4;

      if (file.size > maxSizeMb * 1024 * 1024) {
        throw new Error(`O ficheiro excede ${maxSizeMb}MB.`);
      }

      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Formato inválido. Use PNG, JPG ou WEBP.");
      }

      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("https://bitiray.com/invoicing-company-logo", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.status !== "success") {
        throw new Error(data.message || "Erro ao carregar o logo.");
      }

      const updateResponse = await updateLogoUrl(data.fileName);

      if (updateResponse.status !== "success") {
        throw new Error(updateResponse.message || "Erro ao salvar o logo.");
      }

      if (companyCache) {
        companyCache.logoUrl = data.fileName;
        fillLogoSection(companyCache);
      }

      $("#previewModal").modal("hide");

      Swal.fire({
        icon: "success",
        title: "Sucesso!",
        text: "Logotipo actualizado com sucesso.",
        showConfirmButton: true
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro!",
        text: error.message || "Erro ao carregar o logo. Tente novamente.",
        showConfirmButton: true
      });
    } finally {
      setButtonLoading(els.btnSaveLogo, false);
    }
  }

  function handleLogoSelection() {
    const file = els.inputLogo.files[0];
    if (!file) return;

    if (logoPreviewObjectUrl) {
      URL.revokeObjectURL(logoPreviewObjectUrl);
    }

    logoPreviewObjectUrl = URL.createObjectURL(file);
    els.logoPreview.src = logoPreviewObjectUrl;
    $("#previewModal").modal("show");
  }

  function bindEvents() {
    els.btnEditCompanyInfo?.addEventListener("click", populateCompanyModal);

    els.btnUpdateCompany?.addEventListener("click", function (e) {
      e.preventDefault();
      updateCompanyInfo();
    });

    els.btnOpenBankModal?.addEventListener("click", function () {
      resetBankModal();
      $("#bank_account_modal").modal("show");
    });

    els.companyBankModal?.addEventListener("change", handleOtherBankVisibility);
    els.btnSaveBankAccount?.addEventListener("click", saveBankInfo);

    document.addEventListener("click", function (e) {
      const editBtn = e.target.closest(".btn-edit-bank");
      if (editBtn) {
        populateBankModalForEdit(editBtn.dataset.id);
        return;
      }

      const deleteBtn = e.target.closest(".btn-delete-bank");
      if (deleteBtn) {
        deleteBank(deleteBtn.dataset.id);
        return;
      }

      const primaryBtn = e.target.closest(".btn-set-primary-bank");
      if (primaryBtn) {
        setPrimaryBank(primaryBtn.dataset.id);
      }
    });

    document.querySelectorAll(".bank-toggle").forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        clearTimeout(bankVisibilitySaveTimer);
        bankVisibilitySaveTimer = setTimeout(updateBankVisibility, 450);
      });
    });

    els.btnAddLogo?.addEventListener("click", function () {
      els.inputLogo.click();
    });

    els.inputLogo?.addEventListener("change", handleLogoSelection);
    els.btnSaveLogo?.addEventListener("click", uploadLogo);

    els.modSalesCheckbox?.addEventListener("change", updateModuleOptionStyles);
    els.modInvoicingCheckbox?.addEventListener("change", updateModuleOptionStyles);
    els.btnSaveModule?.addEventListener("click", updateModule);

    $("#previewModal").on("hidden.bs.modal", function () {
      if (logoPreviewObjectUrl) {
        URL.revokeObjectURL(logoPreviewObjectUrl);
        logoPreviewObjectUrl = null;
      }
    });

    $("#bank_account_modal").on("hidden.bs.modal", function () {
      resetBankModal();
    });
  }

  bindEvents();

  loadCompanyInfo().catch((error) => {
    console.error(error);
    Swal.fire({
      icon: "error",
      title: "Erro",
      text: error.message || "Não foi possível carregar os dados da empresa."
    });
  });
});