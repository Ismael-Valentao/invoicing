document.addEventListener("DOMContentLoaded", function () {
  const btnEditCompanyInfo = document.getElementById("btn-edit-compnay-info");

  document.getElementById("btn-open-modalbankInfo").addEventListener("click", function (e) {
    // Pegando os valores existentes
    const bankName = document.getElementById("bank_name").value;
    if(!bankName || bankName.trim() === '') return
    const accountName = document.getElementById("bank_user_name").value;
    const accountNumber = document.getElementById("bank_num_account").value;
    const nib = document.getElementById("bank_nib").value;
    const nuib = document.getElementById("bank_nuib").value;

    // Referências do modal
    const bankSelect = document.getElementById("companyBankModal");
    const bankOtherInput = document.getElementById("companyBankOtherModal");
    const modalAccountName = document.getElementById("modal_bank_user_name");
    const modalAccountNumber = document.getElementById("modal_bank_num_account");
    const modalNIB = document.getElementById("modal_bank_nib");
    const modalNUIB = document.getElementById("modal_bank_nuib");

    // Resetando o campo "Outro"
    bankOtherInput.classList.add("d-none");
    bankOtherInput.value = "";

    // Verificando se o banco existe na lista
    let found = false;
    for (let i = 0; i < bankSelect.options.length; i++) {
      if (bankSelect.options[i].value === bankName) {
        bankSelect.selectedIndex = i;
        found = true;
        break;
      }
    }

    if (!found) {
      // Caso o banco não exista na lista, selecionar "Outro"
      for (let i = 0; i < bankSelect.options.length; i++) {
        if (bankSelect.options[i].value === "Outro") {
          bankSelect.selectedIndex = i;
          bankOtherInput.classList.remove("d-none");
          bankOtherInput.value = bankName;
          break;
        }
      }
    }

    // Preencher os demais campos
    modalAccountName.value = accountName;
    modalAccountNumber.value = accountNumber;
    modalNIB.value = nib;
    modalNUIB.value = nuib;
  });


  btnEditCompanyInfo.addEventListener("click", function () {
    // Fetch current company data from the input fields
    const companyName = document.getElementById("companyName").value;
    const companyNUIT = document.getElementById("companyNUIT").value;
    const companyContact = document.getElementById("companyContact").value;
    const companyEmail = document.getElementById("companyEmail").value;
    const companyAddress = document.getElementById("companyAddress").value;

    // Populate the modal input fields with the current data
    document.getElementById("companyNameModal").value = companyName;
    document.getElementById("companyNUITModal").value = companyNUIT;
    document.getElementById("companyContactModal").value = companyContact;
    document.getElementById("companyEmailModal").value = companyEmail;
    document.getElementById("companyAddressModal").value = companyAddress;
  });

  document.getElementById("btn-update-company").addEventListener("click", function (e) {
    e.preventDefault();
    const data = {
      companyName: document.getElementById("companyNameModal").value,
      companyNUIT: document.getElementById("companyNUITModal").value,
      companyContact: document.getElementById("companyContactModal").value,
      companyEmail: document.getElementById("companyEmailModal").value,
      companyAddress: document.getElementById("companyAddressModal").value
    }

    let isFormValid = validateForm(document.getElementById('companyForm'))

    if (isFormValid) {
      fetch('/api/company', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      }).then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            console.log(data.company)
            document.getElementById("companyName").value = document.getElementById("companyNameModal").value;
            document.getElementById("companyNUIT").value = document.getElementById("companyNUITModal").value;
            document.getElementById("companyContact").value = document.getElementById("companyContactModal").value;
            document.getElementById("companyEmail").value = document.getElementById("companyEmailModal").value;
            document.getElementById("companyAddress").value = document.getElementById("companyAddressModal").value;

            // Close the modal
            $('#companyModal').modal('hide');

            Swal.fire({
              icon: 'success',
              text: 'Dados da empresa actualizados com sucesso!',
              showConfirmButton: false,
              timer: 1500
            });
          } else {
            console.log('Some error here')
            Swal.fire({
              icon: 'error',
              text: 'Erro ao actualizar os dados da empresa. Por favor, tente novamente.',
              showConfirmButton: true
            });
          }
        })
        .catch(error => {
          console.error('Error:', error);
          Swal.fire({
            icon: 'error',
            text: 'Erro ao actualizar os dados da empresa. Por favor, tente novamente.',
            showConfirmButton: true
          });
        });

    }
    else {
      Swal.fire({
        icon: 'error',
        title: 'Todos os campos devem estar devidamente preenchidos.',
        showConfirmButton: true
      });
    }
  })

  function validateForm() {
    const form = document.getElementById("companyForm");
    const inputs = form.querySelectorAll("input[required]");
    let isValid = true;

    inputs.forEach((input) => {
      if (input.value.trim() === "") {
        input.style.border = "1px solid red";
        isValid = false;
      } else {
        input.style.border = "1px solid #ced4da"; // cor padrão do bootstrap
      }
    });

    return isValid;
  }

})
async function getCompanyInfo() {
  fetch("/api/company/company")
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        const company = data.company;
        document.getElementById("companyName").value = company.name;
        document.getElementById("companyAddress").value = company.address;
        document.getElementById("companyContact").value = company.contact;
        document.getElementById("companyEmail").value = company.email;
        document.getElementById("companyNUIT").value = company.nuit;
        if (company.logoUrl) {
          document.getElementById("company_logo_preview").src = 'https://bitiray.com/public/invoicing-logos/' + company.logoUrl;
        }
        if (!company.bankDetails) {
          document.getElementById("btn-open-modalbankInfo-span").innerText = 'Adicionar Dados Bancários'
          return
        }

        document.getElementById("btn-open-modalbankInfo-span").innerText = 'Actualizar Dados Bancários'
        document.getElementById("bank_name").value = company.bankDetails.bank;
        document.getElementById("bank_user_name").value = company.bankDetails.account_name;
        document.getElementById("bank_num_account").value = company.bankDetails.account_number;
        document.getElementById("bank_nib").value = company.bankDetails.nib;
        document.getElementById("bank_nuib").value = company.bankDetails.nuib || "";

      } else {
        console.error("Error fetching company info:", data.message);
      }
    })
    .catch((error) => console.error("Error:", error));
}

async function updateLogoUrl(url) {
  const response = await fetch("/api/company/logo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ logo_name: url }),
  });
  return response.json();
}

document.addEventListener("DOMContentLoaded", async function () {
  //Bank Selection Area
  document.getElementById("companyBankModal").addEventListener("change", function (e) {
    if (this.value.toLowerCase() === "outro") {
      this.classList.add("d-none")
      document.getElementById("companyBankOtherModal").classList.remove("d-none");
    }
  })

  //Logo Area
  const input_logo = document.getElementById("input-logo");
  const logo_preview = document.getElementById("logo_preview");

  document
    .getElementById("btn-add-logo")
    .addEventListener("click", function (e) {
      input_logo.click();
    });

  input_logo.addEventListener("change", function (e) {
    if (!this.files[0]) {
      return;
    }
    const imageUrl = URL.createObjectURL(input_logo.files[0]);
    logo_preview.src = imageUrl;

    $("#previewModal").modal("show");
  });

  document
    .getElementById("btn-save")
    .addEventListener("click", async function (e) {
      const formData = new FormData();
      formData.append("logo", input_logo.files[0]);

      try {
        const response = await fetch(
          "https://bitiray.com/invoicing-company-logo",
          {
            method: "POST",
            body: formData,
          }
        );
        const data = await response.json();
        if (data.status === "success") {
          const updateResponse = await updateLogoUrl(data.fileName);
          if (updateResponse.status === "success") {
            Swal.fire({
              icon: "success",
              title: "Sucesso!",
              text: "Logo actualizada com sucesso. Faça logout e login para ver as alterações.",
              showConfirmButton: true,
              confirmButtonText: "OK",
            });
            $("#previewModal").modal("hide");
          } else {
            Swal.fire({
              icon: "error",
              title: "Erro!",
              text: updateResponse.message,
              showConfirmButton: true,
              confirmButtonText: "OK",
            });
          }
        } else {
          Swal.fire({
            icon: "error",
            title: "Erro!",
            text: data.message,
            showConfirmButton: true,
            confirmButtonText: "OK",
          });
        }
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Erro!",
          text: "Erro ao carregar o logo. Tente novamente.",
          showConfirmButton: true,
          confirmButtonText: "OK",
        });
      }
    });
  getCompanyInfo();
});

document.addEventListener("DOMContentLoaded", function () {
  const btnUpdateBankAccount = document.getElementById("btn-update-company-bankaccount");

  btnUpdateBankAccount.addEventListener("click", async function () {
    try {
      // 1. Obter valores do formulário
      let bank = document.getElementById("companyBankModal").value;
      const otherBankInput = document.getElementById("companyBankOtherModal");
      if (bank === "Outro" && otherBankInput.value.trim() !== "") {
        bank = otherBankInput.value.trim();
      }

      const accountName = document.getElementById("modal_bank_user_name").value.trim();
      const accountNumber = document.getElementById("modal_bank_num_account").value.trim();
      const nib = document.getElementById("modal_bank_nib").value.trim();
      const nuib = document.getElementById("modal_bank_nuib").value.trim();

      // Validação simples
      if (!bank || !accountName || !accountNumber || !nib) {
        Swal.fire({
          icon: "error",
          title: "Erro!",
          text: "Preencha todos os campos obrigatórios.",
          showConfirmButton: true,
          confirmButtonText: "OK",
        });
        return;
      }

      // 2. Construir objeto
      const bankDetails = {
        bank,
        account_name: accountName,
        account_number: accountNumber,
        nib,
        nuib
      };

      // 3. Enviar para API (ajusta o endpoint conforme teu backend)
      const response = await fetch(`/api/company/update-bank`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ bankDetails })
      });

      if (!response.ok) {
        throw new Error("Erro ao atualizar dados bancários");
      }

      const data = await response.json();

      // 4. Atualizar os inputs da tela
      document.getElementById("bank_name").value = data.bankDetails.bank;
      document.getElementById("bank_user_name").value = data.bankDetails.account_name;
      document.getElementById("bank_num_account").value = data.bankDetails.account_number;
      document.getElementById("bank_nib").value = data.bankDetails.nib;
      document.getElementById("bank_nuib").value = data.bankDetails.nuib || "";

      // 5. Fechar modal
      $("#bank_account_modal").modal("hide");

      Swal.fire({
        icon: "success",
        title: "Sucesso!",
        text: "Dados actualizados com sucesso. Faça logout e login para ver as alterações.",
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Erro!",
        text: "Erro ao actualizar os dados bancários.",
        showConfirmButton: true,
        confirmButtonText: "OK",
      });
    }
  });
});
