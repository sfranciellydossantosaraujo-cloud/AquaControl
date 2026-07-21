const API_URL = "http://localhost:3000/api";

// --- Estado Global ---
const state = {
  user: null,
  activePage: "dashboard",
  clientes: [],
  leituras: [],
  taloes: [],
  config: { valor_m3: "5.00" },
  currentTalao: null,
  chartInstance: null
};

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  // Configurar listeners de navegação
  setupNavigation();
  
  // Configurar formulários e modais
  setupFormsAndModals();
  
  // Carregar sessão
  checkSession();

  // Registrar ícones do Lucide se houver a biblioteca, senão lucide.createIcons() rodará
  try {
    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (e) {}
}

// --- Autenticação ---
function checkSession() {
  const savedUser = localStorage.getItem("aquacontrol_user");
  if (savedUser) {
    state.user = JSON.parse(savedUser);
    document.getElementById("loginWrapper").style.display = "none";
    document.getElementById("userNameSpan").innerText = state.user.username;
    document.getElementById("userAvatarDiv").innerText = state.user.username[0].toUpperCase();
    
    // Carrega dados iniciais globais
    loadGlobalData();
  } else {
    document.getElementById("loginWrapper").style.display = "flex";
  }
}

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPass").value.trim();
  const alertBox = document.getElementById("loginAlert");
  
  alertBox.style.display = "none";

  if (!user || !pass) {
    alertBox.innerText = "Preencha todos os campos.";
    alertBox.classList.add("danger");
    return;
  }

  fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, senha: pass })
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao fazer login");
      return data;
    })
    .then((data) => {
      if (data.success) {
        state.user = data.user;
        localStorage.setItem("aquacontrol_user", JSON.stringify(data.user));
        document.getElementById("loginWrapper").style.display = "none";
        document.getElementById("userNameSpan").innerText = data.user.username;
        document.getElementById("userAvatarDiv").innerText = data.user.username[0].toUpperCase();
        
        showToast("Login realizado com sucesso!", "success");
        loadGlobalData();
      }
    })
    .catch((err) => {
      alertBox.innerText = err.message || "Erro ao fazer login.";
      alertBox.classList.add("danger");
    });
}

function handleLogout() {
  state.user = null;
  localStorage.removeItem("aquacontrol_user");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginAlert").style.display = "none";
  document.getElementById("loginWrapper").style.display = "flex";
  showToast("Sessão encerrada.", "success");
}

// --- Carregamento de Dados ---
function loadGlobalData() {
  // Carrega configurações globais
  fetch(`${API_URL}/config`)
    .then((r) => r.json())
    .then((data) => {
      state.config = data;
      const input = document.getElementById("configValorM3");
      if (input) input.value = parseFloat(data.valor_m3).toFixed(2);
    })
    .catch((e) => console.error("Erro ao carregar configurações", e));

  // Roteia para a página inicial ativa
  navigateTo(state.activePage);
}

// --- Navegação & SPA Routing ---
function setupNavigation() {
  // Monitorar cliques no menu
  const menuLinks = document.querySelectorAll(".sidebar-menu .menu-item a");
  menuLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const pageId = link.getAttribute("href").substring(1);
      navigateTo(pageId);
      
      // Fechar sidebar no mobile se ativa
      document.getElementById("sidebar").classList.remove("active");
      document.getElementById("sidebarOverlay").classList.remove("active");
    });
  });

  // Hamburger mobile
  document.getElementById("hamburgerBtn").addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("sidebarOverlay").classList.add("active");
  });

  document.getElementById("sidebarOverlay").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("active");
    document.getElementById("sidebarOverlay").classList.remove("active");
  });
}

function navigateTo(pageId) {
  state.activePage = pageId;
  
  // Atualizar visual do menu
  document.querySelectorAll(".sidebar-menu .menu-item").forEach((li) => {
    const href = li.querySelector("a").getAttribute("href").substring(1);
    if (href === pageId) {
      li.classList.add("active");
    } else {
      li.classList.remove("active");
    }
  });

  // Alternar telas
  document.querySelectorAll(".page").forEach((page) => {
    if (page.id === `${pageId}Page`) {
      page.classList.add("active");
    } else {
      page.classList.remove("active");
    }
  });

  // Carregar dados específicos da página
  if (pageId === "dashboard") {
    loadDashboard();
  } else if (pageId === "clientes") {
    loadClientes();
  } else if (pageId === "leituras") {
    loadLeituras();
  } else if (pageId === "taloes") {
    loadTaloes();
  } else if (pageId === "relatorios") {
    loadRelatorios();
  } else if (pageId === "modelotalao") {
    loadModeloTalao();
  }
}

// --- Funções Auxiliares de Formatação ---
function formatCurrency(val) {
  return parseFloat(val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
}

// --- Lógica: DASHBOARD ---
function loadDashboard() {
  fetch(`${API_URL}/dashboard`)
    .then((r) => r.json())
    .then((metrics) => {
      // Preencher Cards
      document.getElementById("dashTotalClientes").innerText = metrics.total_clientes;
      document.getElementById("dashTotalArrecadado").innerText = formatCurrency(metrics.total_arrecadado);
      document.getElementById("dashTotalPix").innerText = formatCurrency(metrics.total_pix || 0);
      document.getElementById("dashTotalPresencial").innerText = formatCurrency(metrics.total_presencial || 0);
      document.getElementById("dashTotalPendente").innerText = formatCurrency(metrics.total_pendente);
      document.getElementById("dashInadimplentes").innerText = metrics.total_inadimplentes;

      // Inicializar Gráfico
      initDashboardChart(metrics.historico_mensal);
    })
    .catch((err) => {
      console.error("Erro ao carregar dashboard", err);
      showToast("Erro ao carregar dados do dashboard.", "danger");
    });
}

function initDashboardChart(historico) {
  const ctx = document.getElementById("dashboardChart").getContext("2d");
  
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  // Ordenar histórico por mês
  historico.sort((a, b) => a.mes.localeCompare(b.mes));

  const labels = historico.map((h) => {
    const [ano, mes] = h.mes.split("-");
    return `${mes}/${ano}`;
  });
  const consumos = historico.map((h) => h.consumo);
  const faturamentos = historico.map((h) => h.faturamento);

  const isDark = document.body.getAttribute("data-theme") !== "light";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  const textColor = isDark ? "hsl(215, 20%, 65%)" : "hsl(222, 20%, 40%)";

  state.chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.length > 0 ? labels : ["Sem dados"],
      datasets: [
        {
          label: "Consumo Total (m³)",
          data: consumos.length > 0 ? consumos : [0],
          backgroundColor: "rgba(0, 180, 245, 0.65)",
          borderColor: "rgba(0, 180, 245, 1)",
          borderWidth: 1,
          yAxisID: "y-consumo",
          borderRadius: 4
        },
        {
          label: "Faturamento (R$)",
          data: faturamentos.length > 0 ? faturamentos : [0],
          type: "line",
          backgroundColor: "rgba(10, 210, 180, 0.1)",
          borderColor: "rgba(10, 210, 180, 1)",
          borderWidth: 3,
          tension: 0.35,
          yAxisID: "y-faturamento",
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor,
            font: { family: "'Outfit', sans-serif", size: 12 }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: "'Outfit', sans-serif" } }
        },
        "y-consumo": {
          type: "linear",
          position: "left",
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: "'Outfit', sans-serif" } },
          title: { display: true, text: "Consumo (m³)", color: textColor }
        },
        "y-faturamento": {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: textColor, font: { family: "'Outfit', sans-serif" } },
          title: { display: true, text: "Faturamento (R$)", color: textColor }
        }
      }
    }
  });
}

// --- Lógica: CLIENTES ---
function loadClientes() {
  fetch(`${API_URL}/clientes`)
    .then((r) => r.json())
    .then((clientes) => {
      state.clientes = clientes;
      renderClientesTable(clientes);
      updateClientSelects();
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao carregar clientes.", "danger");
    });
}

function renderClientesTable(lista) {
  const tbody = document.getElementById("clientesTableBody");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Nenhum cliente encontrado</td></tr>`;
    return;
  }

  lista.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${c.nome}</strong></td>
      <td>${c.endereco || "-"}</td>
      <td><code>${c.hidrometro || "-"}</code></td>
      <td><span class="badge ${c.poco === 'Poço 2' ? 'poco2' : 'poco1'}">${c.poco}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" onclick="openEditClienteModal(${c.id})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn-icon" onclick="viewClienteDetails(${c.id})" title="Histórico / Detalhes"><i class="fa-solid fa-clock-rotate-left"></i></button>
          <button class="btn-icon delete" onclick="deleteCliente(${c.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
    tbody.appendChild(tr);
  });
}

function filterClientes(query) {
  const term = query.toLowerCase().trim();
  const filtered = state.clientes.filter(
    (c) =>
      c.nome.toLowerCase().includes(term) ||
      (c.endereco && c.endereco.toLowerCase().includes(term)) ||
      (c.hidrometro && c.hidrometro.toLowerCase().includes(term))
  );
  renderClientesTable(filtered);
}

function handleClienteSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("clienteId").value;
  const nome = document.getElementById("clienteNome").value.trim();
  const endereco = document.getElementById("clienteEndereco").value.trim();
  const hidrometro = document.getElementById("clienteHidrometro").value.trim();

  // Se estiver editando, mantém o poço existente. Se for novo, define como "Poço 1".
  let poco = "Poço 1";
  if (id) {
    const c = state.clientes.find((item) => item.id == id);
    if (c) poco = c.poco;
  }

  if (!nome) {
    showToast("O nome é obrigatório", "danger");
    return;
  }

  const payload = { nome, endereco, poco, hidrometro };
  const method = id ? "PUT" : "POST";
  const url = id ? `${API_URL}/clientes/${id}` : `${API_URL}/clientes`;

  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.error) throw new Error(res.error);
      showToast(id ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!", "success");
      closeModal("clienteModal");
      loadClientes();
    })
    .catch((err) => {
      showToast(err.message, "danger");
    });
}

function openAddClienteModal() {
  document.getElementById("clienteModalTitle").innerText = "Cadastrar Cliente";
  document.getElementById("clienteForm").reset();
  document.getElementById("clienteId").value = "";
  openModal("clienteModal");
}

function openEditClienteModal(id) {
  const c = state.clientes.find((item) => item.id === id);
  if (!c) return;

  document.getElementById("clienteModalTitle").innerText = "Editar Cliente";
  document.getElementById("clienteId").value = c.id;
  document.getElementById("clienteNome").value = c.nome;
  document.getElementById("clienteEndereco").value = c.endereco;
  document.getElementById("clienteHidrometro").value = c.hidrometro || "";
  openModal("clienteModal");
}

function deleteCliente(id) {
  if (confirm("Tem certeza que deseja excluir este cliente? Todas as leituras e talões associados também serão excluídos permanently.")) {
    fetch(`${API_URL}/clientes/${id}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((res) => {
        showToast("Cliente removido com sucesso.", "success");
        loadClientes();
      })
      .catch((e) => {
        console.error(e);
        showToast("Erro ao remover cliente.", "danger");
      });
  }
}

// Detalhes & Histórico do Cliente
function viewClienteDetails(id) {
  fetch(`${API_URL}/clientes/${id}`)
    .then((r) => r.json())
    .then((data) => {
      const { cliente, leituras, taloes } = data;
      
      document.getElementById("detailClienteNome").innerText = cliente.nome;
      document.getElementById("detailClienteHidrometro").innerText = cliente.hidrometro || "-";
      document.getElementById("detailClientePoco").innerText = cliente.poco;
      document.getElementById("detailClienteEndereco").innerText = cliente.endereco || "-";

      // Preencher Leituras
      const leiturasTbody = document.getElementById("detailLeiturasBody");
      leiturasTbody.innerHTML = "";
      if (leituras.length === 0) {
        leiturasTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhuma leitura registrada</td></tr>`;
      } else {
        leituras.forEach((l) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${formatDate(l.data)}</td>
            <td>${l.leitura_anterior.toFixed(1)} m³</td>
            <td>${l.leitura_atual.toFixed(1)} m³</td>
            <td><strong>${l.consumo.toFixed(1)} m³</strong></td>
          `;
          leiturasTbody.appendChild(tr);
        });
      }

      // Preencher Talões
      const taloesTbody = document.getElementById("detailTaloesBody");
      taloesTbody.innerHTML = "";
      if (taloes.length === 0) {
        taloesTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum talão gerado</td></tr>`;
      } else {
        taloes.forEach((t) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>Venc. ${formatDate(t.data_vencimento)}</td>
            <td>${formatCurrency(t.valor)}</td>
            <td>
              ${
                t.status === "pago"
                  ? t.tipo_pagamento === "pix"
                    ? `<span class="badge pago"><i class="fa-solid fa-qrcode"></i> PIX</span>`
                    : t.tipo_pagamento === "presencial"
                    ? `<span class="badge pago" style="background-color: hsla(174, 100%, 41%, 0.15); color: var(--color-secondary);"><i class="fa-solid fa-wallet"></i> Presencial</span>`
                    : `<span class="badge pago">PAGO</span>`
                  : `<span class="badge pendente">PENDENTE</span>`
              }
            </td>
            <td>
              ${t.status === 'pendente' ? 
                `<button class="btn-icon pay" onclick="openConfirmarPagamentoModal(${t.id})" title="Dar Baixa"><i class="fa-solid fa-check"></i></button>` : 
                `-`
              }
            </td>
          `;
          taloesTbody.appendChild(tr);
        });
      }

      openModal("clienteDetailsModal");
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao carregar detalhes do cliente.", "danger");
    });
  // Salvar ID do cliente detalhado ativo no estado global
  state.currentDetailClienteId = id;
}

function openConfirmarPagamentoModal(talaoId) {
  document.getElementById("baixaTalaoId").value = talaoId;
  document.getElementById("baixaMeioPagamento").value = "pix";
  openModal("baixaPagamentoModal");
}

function handleBaixaPagamentoSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("baixaTalaoId").value;
  const tipo_pagamento = document.getElementById("baixaMeioPagamento").value;

  fetch(`${API_URL}/taloes/${id}/pago`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo_pagamento })
  })
    .then((r) => r.json())
    .then(() => {
      showToast("Fatura baixada com sucesso!", "success");
      closeModal("baixaPagamentoModal");
      
      // Recarregar dados
      if (state.activePage === "taloes") {
        loadTaloes();
      } else if (state.activePage === "relatorios") {
        loadRelatorios();
      } else if (state.activePage === "dashboard") {
        loadDashboard();
      }
      
      // Se a ficha de detalhes do cliente estiver aberta, atualiza ela
      const detailsModal = document.getElementById("clienteDetailsModal");
      if (detailsModal && detailsModal.style.display === "block" && state.currentDetailClienteId) {
        viewClienteDetails(state.currentDetailClienteId);
      }
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao dar baixa no pagamento.", "danger");
    });
}

function updateClientSelects() {
  const selectLeitura = document.getElementById("leituraClienteId");
  if (!selectLeitura) return;

  selectLeitura.innerHTML = `<option value="">Selecione um cliente...</option>`;
  state.clientes.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.innerText = `${c.nome} (${c.poco})`;
    selectLeitura.appendChild(opt);
  });
}

// --- Lógica: LEITURAS ---
function loadLeituras() { 
  fetch(`${API_URL}/leituras`)
    .then((r) => r.json())
    .then((leituras) => {
      state.leituras = leituras;
      renderLeiturasTable(leituras);
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao carregar leituras.", "danger");
    });
}

function renderLeiturasTable(lista) {
  const tbody = document.getElementById("leiturasTableBody");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Nenhuma leitura registrada</td></tr>`;
    return;
  }

  lista.forEach((l) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(l.data)}</td>
      <td><strong>${l.cliente_nome}</strong></td>
      <td><span class="badge ${l.cliente_poco === 'Poço 2' ? 'poco2' : 'poco1'}">${l.cliente_poco}</span></td>
      <td>${l.leitura_anterior.toFixed(1)} m³</td>
      <td>${l.leitura_atual.toFixed(1)} m³</td>
      <td><strong style="color: var(--color-primary);">${l.consumo.toFixed(1)} m³</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function filterLeituras(query) {
  const term = query.toLowerCase().trim();
  const filtered = state.leituras.filter(
    (l) =>
      l.cliente_nome.toLowerCase().includes(term) ||
      l.cliente_poco.toLowerCase().includes(term) ||
      l.data.includes(term)
  );
  renderLeiturasTable(filtered);
}

function handleLeituraClienteChange() {
  const clienteId = document.getElementById("leituraClienteId").value;
  const divInfo = document.getElementById("leituraAnteriorInfo");

  if (!clienteId) {
    divInfo.innerHTML = "";
    return;
  }

  // Buscar última leitura do cliente para ajudar na interface
  fetch(`${API_URL}/clientes/${clienteId}`)
    .then((r) => r.json())
    .then((data) => {
      const { leituras } = data;
      if (leituras.length > 0) {
        const ult = leituras[0];
        divInfo.innerHTML = `💡 Última leitura registrada em <strong>${formatDate(ult.data)}</strong> foi de <strong>${ult.leitura_atual} m³</strong>.`;
      } else {
        divInfo.innerHTML = `💡 Nenhuma leitura anterior registrada. O valor inicial padrão será <strong>0.0 m³</strong>.`;
      }
    });
}

function handleLeituraSubmit(e) {
  e.preventDefault();
  const cliente_id = document.getElementById("leituraClienteId").value;
  const leitura_atual = document.getElementById("leituraAtual").value;
  const data = document.getElementById("leituraData").value;

  if (!cliente_id || !leitura_atual || !data) {
    showToast("Preencha todos os campos obrigatórios.", "danger");
    return;
  }

  fetch(`${API_URL}/leituras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id, leitura_atual, data })
  })
    .then(async (r) => {
      const res = await r.json();
      if (!r.ok) throw new Error(res.error || "Erro ao registrar leitura");
      return res;
    })
    .then((res) => {
      showToast(`Leitura lançada! Consumo: ${res.consumo}m³, Faturamento gerado: ${formatCurrency(res.valor)}`, "success");
      closeModal("leituraModal");
      loadLeituras();
    })
    .catch((err) => {
      showToast(err.message, "danger");
    });
}

function openAddLeituraModal() {
  document.getElementById("leituraForm").reset();
  document.getElementById("leituraAnteriorInfo").innerHTML = "";
  document.getElementById("leituraData").value = new Date().toISOString().split("T")[0];
  openModal("leituraModal");
}

// --- Lógica: TALÕES (FINANCEIRO) ---
function loadTaloes() {
  fetch(`${API_URL}/taloes`)
    .then((r) => r.json())
    .then((taloes) => {
      state.taloes = taloes;
      renderTaloesTable(taloes);
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao carregar talões.", "danger");
    });
}

function renderTaloesTable(lista) {
  const tbody = document.getElementById("taloesTableBody");
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">Nenhum talão de cobrança emitido</td></tr>`;
    return;
  }

  lista.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>Venc. ${formatDate(t.data_vencimento)}</td>
      <td><strong>${t.cliente_nome}</strong></td>
      <td>${t.consumo.toFixed(1)} m³</td>
      <td><strong>${formatCurrency(t.valor)}</strong></td>
      <td>
        ${
          t.status === "pago"
            ? t.tipo_pagamento === "pix"
              ? `<span class="badge pago"><i class="fa-solid fa-qrcode"></i> PIX</span>`
              : t.tipo_pagamento === "presencial"
              ? `<span class="badge pago" style="background-color: hsla(174, 100%, 41%, 0.15); color: var(--color-secondary);"><i class="fa-solid fa-wallet"></i> Presencial</span>`
              : `<span class="badge pago">PAGO</span>`
            : `<span class="badge pendente">PENDENTE</span>`
        }
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn-icon" onclick="viewTalaoInvoice(${t.id})" title="Ver Fatura / Talão"><i class="fa-solid fa-file-invoice-dollar"></i></button>
          ${
            t.status === "pendente"
              ? `<button class="btn-icon pay" onclick="openConfirmarPagamentoModal(${t.id})" title="Dar Baixa"><i class="fa-solid fa-check"></i></button>`
              : `<button class="btn-icon" onclick="toggleTalaoStatus(${t.id}, 'pendente')" title="Estornar para Pendente"><i class="fa-solid fa-rotate-left"></i></button>`
          }
          <button class="btn-icon delete" onclick="deleteTalao(${t.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTaloes() {
  const query = document.getElementById("searchTaloesInput").value.toLowerCase().trim();
  const activeTab = document.querySelector(".financial-tabs .btn-tab.active");
  const tabStatus = activeTab ? activeTab.getAttribute("data-status") : "todos";

  const filtered = state.taloes.filter((t) => {
    const matchesSearch =
      t.cliente_nome.toLowerCase().includes(query) ||
      t.cliente_poco.toLowerCase().includes(query) ||
      t.data_vencimento.includes(query);
      
    let matchesStatus = true;
    if (tabStatus === "pendente") {
      matchesStatus = t.status === "pendente";
    } else if (tabStatus === "pago-pix") {
      matchesStatus = t.status === "pago" && t.tipo_pagamento === "pix";
    } else if (tabStatus === "pago-presencial") {
      matchesStatus = t.status === "pago" && t.tipo_pagamento === "presencial";
    }
    
    return matchesSearch && matchesStatus;
  });

  renderTaloesTable(filtered);
}

function toggleTalaoStatus(id, newStatus) {
  const endpoint = newStatus === "pago" ? "pago" : "pendente";
  fetch(`${API_URL}/taloes/${id}/${endpoint}`, { method: "PUT" })
    .then((r) => r.json())
    .then(() => {
      showToast(newStatus === "pago" ? "Fatura baixada com sucesso!" : "Fatura estornada com sucesso.", "success");
      loadTaloes();
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao alterar status da fatura.", "danger");
    });
}

function deleteTalao(id) {
  if (confirm("Tem certeza que deseja excluir esta fatura?")) {
    fetch(`${API_URL}/taloes/${id}`, { method: "DELETE" })
      .then((r) => r.json())
      .then(() => {
        showToast("Fatura removida com sucesso.", "success");
        loadTaloes();
      })
      .catch((e) => {
        console.error(e);
        showToast("Erro ao remover fatura.", "danger");
      });
  }
}

// --- Lógica: RELATÓRIOS ---
function loadRelatorios() {
  fetch(`${API_URL}/taloes`)
    .then((r) => r.json())
    .then((taloes) => {
      state.taloes = taloes;
      setupRelatoriosFilters();
      renderRelatorios();
    })
    .catch((err) => {
      console.error(err);
      showToast("Erro ao carregar dados do relatório.", "danger");
    });
}

function setupRelatoriosFilters() {
  // Preencher meses dinamicamente no select
  const mesSelect = document.getElementById("repFilterMes");
  if (!mesSelect) return;

  // Extrair meses únicos
  const meses = new Set();
  state.taloes.forEach((t) => {
    if (t.data_leitura) {
      const [ano, mes] = t.data_leitura.split("-");
      meses.add(`${ano}-${mes}`);
    }
  });

  // Salvar valor atual
  const currentValue = mesSelect.value;

  // Re-gerar opções
  mesSelect.innerHTML = `<option value="todos">Todos os Meses</option>`;
  Array.from(meses)
    .sort((a, b) => b.localeCompare(a)) // Mais recente primeiro
    .forEach((mesAno) => {
      const [ano, mes] = mesAno.split("-");
      const option = document.createElement("option");
      option.value = mesAno;
      option.innerText = `${mes}/${ano}`;
      mesSelect.appendChild(option);
    });

  // Restaurar valor se possível
  if (currentValue && Array.from(meses).includes(currentValue)) {
    mesSelect.value = currentValue;
  }
}

function renderRelatorios() {
  const searchQuery = document.getElementById("repFilterSearch").value.toLowerCase().trim();
  const statusFilter = document.getElementById("repFilterStatus").value;
  const pocoFilter = document.getElementById("repFilterPoco").value;
  const mesFilter = document.getElementById("repFilterMes").value;

  // 1. Filtrar lista de talões
  const filtered = state.taloes.filter((t) => {
    const matchesSearch = t.cliente_nome.toLowerCase().includes(searchQuery) || 
                          t.cliente_id.toString().includes(searchQuery);

    let matchesStatus = true;
    if (statusFilter === "pendente") {
      matchesStatus = t.status === "pendente";
    } else if (statusFilter === "pago-pix") {
      matchesStatus = t.status === "pago" && t.tipo_pagamento === "pix";
    } else if (statusFilter === "pago-presencial") {
      matchesStatus = t.status === "pago" && t.tipo_pagamento === "presencial";
    } else if (statusFilter === "pago") {
      matchesStatus = t.status === "pago";
    }

    const matchesPoco = pocoFilter === "todos" || t.cliente_poco === pocoFilter;
    
    let matchesMes = true;
    if (mesFilter !== "todos" && t.data_leitura) {
      matchesMes = t.data_leitura.startsWith(mesFilter);
    }

    return matchesSearch && matchesStatus && matchesPoco && matchesMes;
  });

  // 2. Calcular Métricas Globais (com base em toda a base de faturas para o período/poço selecionado)
  const repTaloes = state.taloes.filter((t) => {
    const matchesPoco = pocoFilter === "todos" || t.cliente_poco === pocoFilter;
    let matchesMes = true;
    if (mesFilter !== "todos" && t.data_leitura) {
      matchesMes = t.data_leitura.startsWith(mesFilter);
    }
    return matchesPoco && matchesMes;
  });

  let totalBalanço = 0;
  let totalPago = 0;
  let totalPendente = 0;
  let countTotal = repTaloes.length;
  let countPago = 0;
  let countPendente = 0;

  repTaloes.forEach((t) => {
    totalBalanço += t.valor;
    if (t.status === "pago") {
      totalPago += t.valor;
      countPago++;
    } else {
      totalPendente += t.valor;
      countPendente++;
    }
  });

  const percentPago = totalBalanço > 0 ? (totalPago / totalBalanço) * 100 : 0;

  // Atualizar cards de métricas
  document.getElementById("repTotalBalanço").innerText = formatCurrency(totalBalanço);
  document.getElementById("repCountTotal").innerText = `${countTotal} fatura(s)`;
  
  document.getElementById("repTotalPago").innerText = formatCurrency(totalPago);
  document.getElementById("repCountPago").innerText = `${countPago} fatura(s) paga(s)`;

  document.getElementById("repTotalPendente").innerText = formatCurrency(totalPendente);
  document.getElementById("repCountPendente").innerText = `${countPendente} fatura(s) pendente(s)`;

  document.getElementById("repIndiceRecebimento").innerText = `${percentPago.toFixed(1)}%`;

  // 3. Renderizar Tabela Filtrada
  const tbody = document.getElementById("relatoriosTableBody");
  tbody.innerHTML = "";

  let sumConsumo = 0;
  let sumValor = 0;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">Nenhum pagamento correspondente aos filtros</td></tr>`;
    document.getElementById("repTotalConsumo").innerText = "0.0 m³";
    document.getElementById("repTotalFiltradoValor").innerText = formatCurrency(0);
    document.getElementById("repTotalFiltradoFaturas").innerText = "0 fatura(s)";
    return;
  }

  filtered.forEach((t) => {
    sumConsumo += t.consumo;
    sumValor += t.valor;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(t.data_vencimento)}</td>
      <td><strong>${t.cliente_nome}</strong></td>
      <td><span class="badge ${t.cliente_poco === 'Poço 2' ? 'poco2' : 'poco1'}">${t.cliente_poco}</span></td>
      <td>${formatDate(t.data_leitura)}</td>
      <td>${t.consumo.toFixed(1)} m³</td>
      <td><strong>${formatCurrency(t.valor)}</strong></td>
      <td>
        ${
          t.status === "pago"
            ? t.tipo_pagamento === "pix"
              ? `<span class="badge pago"><i class="fa-solid fa-qrcode"></i> PIX</span>`
              : t.tipo_pagamento === "presencial"
              ? `<span class="badge pago" style="background-color: hsla(174, 100%, 41%, 0.15); color: var(--color-secondary);"><i class="fa-solid fa-wallet"></i> Presencial</span>`
              : `<span class="badge pago">PAGO</span>`
            : `<span class="badge pendente">PENDENTE</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Atualizar linha de rodapé
  document.getElementById("repTotalConsumo").innerText = `${sumConsumo.toFixed(1)} m³`;
  document.getElementById("repTotalFiltradoValor").innerText = formatCurrency(sumValor);
  document.getElementById("repTotalFiltradoFaturas").innerText = `${filtered.length} fatura(s)`;
}

function printRelatorio() {
  document.getElementById("repPrintDate").innerText = new Date().toLocaleString("pt-BR");
  window.print();
}

function downloadRelatorioPDF() {
  const element = document.getElementById("relatoriosPrintArea");
  
  document.getElementById("repPrintDate").innerText = new Date().toLocaleString("pt-BR");
  const printHeader = element.querySelector(".print-only-header");
  if (printHeader) printHeader.style.display = "block";
  
  const options = {
    margin: [10, 10, 10, 10],
    filename: `relatorio_financeiro_${new Date().toISOString().split("T")[0]}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
  };

  try {
    if (window.html2pdf) {
      showToast("Gerando PDF do relatório...", "success");
      html2pdf().from(element).set(options).save().then(() => {
        showToast("Relatório baixado com sucesso!", "success");
        if (printHeader) printHeader.style.display = "none";
      });
    } else {
      showToast("Biblioteca de geração de PDF não carregada. Usando impressão nativa.", "warning");
      window.print();
    }
  } catch (e) {
    console.error(e);
    showToast("Erro ao exportar PDF.", "danger");
    if (printHeader) printHeader.style.display = "none";
  }
}

// Visualizar Fatura de Talão Completa no Modal
// Visualizar Fatura de Talão Completa no Modal com Suporte a Modelos
function viewTalaoInvoice(id) {
  const t = state.taloes.find((item) => item.id === id);
  if (!t) return;

  state.currentTalao = t;

  // --- 1. Preencher Campos do Modelo DETALHADO ---
  document.getElementById("detInvoiceIdSpan").innerText = t.id.toString().padStart(6, "0");
  document.getElementById("detInvoiceStatusSpan").innerText = t.status.toUpperCase();
  document.getElementById("detInvoiceStatusSpan").className = `badge ${t.status}`;
  
  document.getElementById("detInvClienteNome").innerText = t.cliente_nome;
  document.getElementById("detInvClienteEndereco").innerText = t.cliente_endereco || "-";
  document.getElementById("detInvClientePoco").innerText = t.cliente_poco;
  document.getElementById("detInvClienteHidrometro").innerText = t.cliente_hidrometro || "-";

  document.getElementById("detInvLeituraData").innerText = formatDate(t.data_leitura);
  document.getElementById("detInvVencimento").innerText = formatDate(t.data_vencimento);

  document.getElementById("detInvAnterior").innerText = `${t.leitura_anterior.toFixed(1)} m³`;
  document.getElementById("detInvAtual").innerText = `${t.leitura_atual.toFixed(1)} m³`;
  document.getElementById("detInvConsumo").innerText = `${t.consumo.toFixed(1)} m³`;
  
  document.getElementById("detInvValorM3").innerText = formatCurrency(t.valor_m3);
  document.getElementById("detInvValorTotal").innerText = formatCurrency(t.valor);

  // --- 2. Preencher Campos do Modelo TÉRMICO ---
  document.getElementById("therInvoiceIdSpan").innerText = t.id.toString().padStart(6, "0");
  document.getElementById("therInvoiceStatusSpan").innerText = t.status.toUpperCase();
  
  document.getElementById("therInvClienteNome").innerText = t.cliente_nome;
  document.getElementById("therInvClienteEndereco").innerText = t.cliente_endereco || "-";
  document.getElementById("therInvClientePoco").innerText = t.cliente_poco;
  document.getElementById("therInvClienteHidrometro").innerText = t.cliente_hidrometro || "-";

  document.getElementById("therInvLeituraData").innerText = formatDate(t.data_leitura);
  document.getElementById("therInvVencimento").innerText = formatDate(t.data_vencimento);

  document.getElementById("therInvAnterior").innerText = `${t.leitura_anterior.toFixed(1)} m³`;
  document.getElementById("therInvAtual").innerText = `${t.leitura_atual.toFixed(1)} m³`;
  document.getElementById("therInvConsumo").innerText = `${t.consumo.toFixed(1)} m³`;
  
  document.getElementById("therInvValorM3").innerText = formatCurrency(t.valor_m3);
  document.getElementById("therInvValorTotal").innerText = formatCurrency(t.valor);

  // --- 3. Preencher Campos do Modelo DUPLO COM CANHOTO ---
  // Canhoto
  document.getElementById("splitStubInvoiceIdSpan").innerText = t.id.toString().padStart(6, "0");
  document.getElementById("splitStubClienteNome").innerText = t.cliente_nome;
  document.getElementById("splitStubLeituraData").innerText = formatDate(t.data_leitura);
  document.getElementById("splitStubConsumo").innerText = `${t.consumo.toFixed(1)} m³`;
  document.getElementById("splitStubValorTotal").innerText = formatCurrency(t.valor);
  document.getElementById("splitStubVencimento").innerText = formatDate(t.data_vencimento);

  // Via do Cliente
  document.getElementById("splitClientInvoiceIdSpan").innerText = t.id.toString().padStart(6, "0");
  document.getElementById("splitClientInvoiceStatusSpan").innerText = t.status.toUpperCase();
  document.getElementById("splitClientInvoiceStatusSpan").className = `badge ${t.status}`;
  
  document.getElementById("splitClientInvClienteNome").innerText = t.cliente_nome;
  document.getElementById("splitClientInvClienteEndereco").innerText = t.cliente_endereco || "-";
  document.getElementById("splitClientInvClientePoco").innerText = t.cliente_poco;
  document.getElementById("splitClientInvClienteHidrometro").innerText = t.cliente_hidrometro || "-";

  document.getElementById("splitClientInvLeituraData").innerText = formatDate(t.data_leitura);
  document.getElementById("splitClientInvVencimento").innerText = formatDate(t.data_vencimento);

  document.getElementById("splitClientInvAnterior").innerText = `${t.leitura_anterior.toFixed(1)} m³`;
  document.getElementById("splitClientInvAtual").innerText = `${t.leitura_atual.toFixed(1)} m³`;
  document.getElementById("splitClientInvConsumo").innerText = `${t.consumo.toFixed(1)} m³`;
  
  document.getElementById("splitClientInvValorM3").innerText = formatCurrency(t.valor_m3);
  document.getElementById("splitClientInvValorTotal").innerText = formatCurrency(t.valor);

  // --- 4. Gerar QR Codes Pix para as três vias ---
  generatePixQRCode("detInvoiceQRCode", t.valor, 100);
  generatePixQRCode("therInvoiceQRCode", t.valor, 90);
  generatePixQRCode("splitClientInvoiceQRCode", t.valor, 100);

  // Resetar visual para o modelo Detalhado A4 padrão
  changePrintTemplate("detailed");

  openModal("talaoInvoiceModal");
}

// Auxiliar para Gerar Chave Pix Dinâmica
function generatePixQRCode(containerId, valor, size) {
  const qrcodeContainer = document.getElementById(containerId);
  if (!qrcodeContainer) return;
  qrcodeContainer.innerHTML = "";
  
  const pixKey = "aquacontrol@empresa.com.br";
  const pixPayload = `00020101021226580014br.gov.bcb.pix0136${pixKey}5204000053039865406${parseFloat(valor).toFixed(2)}5802BR5911AquaControl6009Sao Paulo62070503***6304`;

  try {
    if (window.QRCode) {
      new QRCode(qrcodeContainer, {
        text: pixPayload,
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qrcodeContainer.innerHTML = `<div style="font-size:0.7rem;text-align:center;">QR Code Pix</div>`;
    }
  } catch (e) {
    console.error("Erro ao gerar QR Code para " + containerId, e);
  }
}

// Alternar Modelos de Impressão dinamicamente no Modal
function changePrintTemplate(templateName) {
  const card = document.getElementById("billInvoiceCard");
  if (!card) return;

  // Ajusta a classe ativa do card
  card.className = `bill-invoice-card layout-${templateName}`;

  // Ajusta os botões do seletor
  document.querySelectorAll(".btn-template-select").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeBtn = document.getElementById(`btnTemplate${templateName.charAt(0).toUpperCase() + templateName.slice(1)}`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  // Registra no estado local
  state.currentPrintTemplate = templateName;
}

function printInvoice() {
  window.print();
}

function downloadInvoicePDF() {
  const element = document.getElementById("billInvoiceCard");
  const template = state.currentPrintTemplate || "detailed";
  
  let jsPDFOptions = { unit: "mm", format: "a4", orientation: "portrait" };
  let margin = 10;
  
  // Otimiza o formato do PDF gerado de acordo com o modelo selecionado
  if (template === "thermal") {
    // Bobina de 80mm e altura de ~175mm
    jsPDFOptions = { unit: "mm", format: [80, 175], orientation: "portrait" };
    margin = 4;
  }

  const options = {
    margin: margin,
    filename: `talao_agua_${template}_${state.currentTalao.cliente_nome.toLowerCase().replace(/\s+/g, "_")}_${state.currentTalao.id}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: jsPDFOptions
  };

  try {
    if (window.html2pdf) {
      showToast("Gerando PDF do talão...", "success");
      html2pdf().from(element).set(options).save().then(() => {
        showToast("PDF baixado com sucesso!", "success");
      });
    } else {
      showToast("Biblioteca de geração de PDF não carregada. Usando impressão nativa.", "warning");
      window.print();
    }
  } catch (e) {
    console.error(e);
    showToast("Erro ao exportar PDF.", "danger");
  }
}

function sendInvoiceNotification() {
  const t = state.currentTalao;
  if (!t) return;

  const text = `Olá, *${t.cliente_nome}*! 💧\n\nIdentificamos a emissão da sua fatura de consumo de água no *${t.cliente_poco}*.\n\n*Detalhes do Consumo:*\n- Período da leitura: ${formatDate(t.data_leitura)}\n- Consumo registrado: *${t.consumo.toFixed(1)} m³*\n- Taxa por m³: ${formatCurrency(t.valor_m3)}\n- *Valor Total a Pagar: ${formatCurrency(t.valor)}*\n- Data de Vencimento: *${formatDate(t.data_vencimento)}*\n\nVocê pode efetuar o pagamento via chave Pix: *financeiro@aquacontrol.com.br* ou utilizando o QR Code gerado em seu talão.\n\nAgradecemos a colaboração!`;
  
  const encodedText = encodeURIComponent(text);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  
  window.open(whatsappUrl, "_blank");
  showToast("Link de aviso gerado! WhatsApp aberto para compartilhamento.", "success");
}

// --- Lógica: CONFIGURAÇÕES ---
function handleConfigSubmit(e) {
  e.preventDefault();
  const valor = document.getElementById("configValorM3").value;

  if (!valor || parseFloat(valor) <= 0) {
    showToast("Insira um valor válido por m³.", "danger");
    return;
  }

  fetch(`${API_URL}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valor_m3: parseFloat(valor).toFixed(2) })
  })
    .then((r) => r.json())
    .then((res) => {
      if (res.error) throw new Error(res.error);
      state.config.valor_m3 = valor;
      showToast("Configuração atualizada com sucesso!", "success");
      loadGlobalData();
    })
    .catch((err) => {
      showToast(err.message, "danger");
    });
}

// --- Modais Auxiliares ---
function openModal(modalId) {
  const overlay = document.getElementById("modalOverlay");
  
  // Ocultar todos os conteúdos de modais
  document.querySelectorAll(".modal-content").forEach((m) => {
    m.style.display = "none";
  });

  // Mostrar modal específico
  const targetModal = document.getElementById(modalId);
  if (targetModal) {
    targetModal.style.display = "block";
    overlay.classList.add("active");
  }
}

function closeModal(modalId) {
  const overlay = document.getElementById("modalOverlay");
  overlay.classList.remove("active");
  
  const targetModal = document.getElementById(modalId);
  if (targetModal) {
    targetModal.style.display = "none";
  }
}

// --- Formulários e Setup Geral ---
function setupFormsAndModals() {
  // Login
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  
  // Clientes
  document.getElementById("clienteForm").addEventListener("submit", handleClienteSubmit);
  document.getElementById("searchClientesInput").addEventListener("input", (e) => {
    filterClientes(e.target.value);
  });

  // Leituras
  document.getElementById("leituraForm").addEventListener("submit", handleLeituraSubmit);
  document.getElementById("leituraClienteId").addEventListener("change", handleLeituraClienteChange);
  document.getElementById("searchLeiturasInput").addEventListener("input", (e) => {
    filterLeituras(e.target.value);
  });

  // Faturamento
  document.getElementById("searchTaloesInput").addEventListener("input", filterTaloes);
  
  // Abas do Financeiro
  const tabs = document.querySelectorAll(".financial-tabs .btn-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      filterTaloes();
    });
  });

  // Confirmação de Pagamento Form
  document.getElementById("baixaPagamentoForm").addEventListener("submit", handleBaixaPagamentoSubmit);

  // Configurações
  document.getElementById("configForm").addEventListener("submit", handleConfigSubmit);

  // Relatórios
  document.getElementById("repFilterSearch").addEventListener("input", renderRelatorios);
  document.getElementById("repFilterStatus").addEventListener("change", renderRelatorios);
  document.getElementById("repFilterPoco").addEventListener("change", renderRelatorios);
  document.getElementById("repFilterMes").addEventListener("change", renderRelatorios);

  // Alternador de Temas (Claro/Escuro)
  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    const isDark = document.body.getAttribute("data-theme") !== "light";
    if (isDark) {
      document.body.setAttribute("data-theme", "light");
      document.getElementById("themeIcon").className = "fa-solid fa-moon";
      document.getElementById("themeText").innerText = "Modo Escuro";
    } else {
      document.body.removeAttribute("data-theme");
      document.getElementById("themeIcon").className = "fa-solid fa-sun";
      document.getElementById("themeText").innerText = "Modo Claro";
    }
    
    // Atualizar gráfico se na tela dashboard
    if (state.activePage === "dashboard" && state.chartInstance) {
      loadDashboard();
    }
  });

  // Fechar Modais com click fora
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") {
      document.getElementById("modalOverlay").classList.remove("active");
    }
  });
}

// --- Gerenciador de Toast ---
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "success" 
    ? '<i class="fa-solid fa-circle-check" style="color:var(--color-success)"></i>' 
    : type === "warning"
    ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-warning)"></i>'
    : '<i class="fa-solid fa-circle-xmark" style="color:var(--color-danger)"></i>';
    
  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;
  
  container.appendChild(toast);

  // Sumir com animação após 3 segundos
  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s reverse forwards";
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, 3000);
}
