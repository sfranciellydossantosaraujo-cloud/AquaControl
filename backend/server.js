const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const db = new sqlite3.Database("./database.db");

// Inicialização do Banco de Dados
db.serialize(() => {
  // Tabela de usuários administrador
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    senha TEXT
  )`);

  // Tabela de clientes
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    endereco TEXT,
    poco TEXT,
    hidrometro TEXT
  )`, (err) => {
    // Adiciona a coluna hidrometro caso a tabela já existisse sem ela
    db.run("ALTER TABLE clientes ADD COLUMN hidrometro TEXT", (alterErr) => {
      // Ignora erro se a coluna já existir
    });
  });

  // Tabela de leituras de consumo
  db.run(`CREATE TABLE IF NOT EXISTS leituras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    leitura_anterior REAL,
    leitura_atual REAL,
    consumo REAL,
    data TEXT,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
  )`);

  // Tabela de talões de cobrança
  db.run(`CREATE TABLE IF NOT EXISTS taloes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    leitura_id INTEGER,
    valor REAL,
    valor_m3 REAL,
    status TEXT DEFAULT 'pendente',
    data_vencimento TEXT,
    tipo_pagamento TEXT,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY(leitura_id) REFERENCES leituras(id) ON DELETE CASCADE
  )`, (err) => 
    // Adiciona a coluna tipo_pagamento caso a tabela já existisse sem ela
    db.run("ALTER TABLE taloes ADD COLUMN tipo_pagamento TEXT", (alterErr) => {
      // Ignora erro se a coluna já existir
    });
  });

  // Tabela de configurações gerais
  db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT
  )`);

  // Dados iniciais padrões
  db.run(`INSERT OR IGNORE INTO usuarios (id, username, senha)
          VALUES (1, 'admin', '123')`);

  db.run(`INSERT OR IGNORE INTO configuracoes (chave, valor)
          VALUES ('valor_m3', '5.00')`);
});

// Helper para somar 15 dias à data YYYY-MM-DD
function calcularVencimento(dataStr) {
  try {
    const data = new Date(dataStr + "T12:00:00");
    data.setDate(data.getDate() + 15);
    return data.toISOString().split("T")[0];
  } catch (e) {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 15);
    return hoje.toISOString().split("T")[0];
  }
}

// --- Endpoints da API ---

// 🔑 Autenticação
app.post("/api/login", (req, res) => {
  const { username, senha } = req.body;
  db.get(
    "SELECT * FROM usuarios WHERE username = ? AND senha = ?",
    [username, senha],
    (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Erro no servidor." });
      }
      if (row) {
        res.json({ success: true, user: { id: row.id, username: row.username } });
      } else {
        res.status(401).json({ success: false, message: "Usuário ou senha incorretos." });
      }
    }
  );
});

// 👤 Clientes (CRUD)
app.get("/api/clientes", (req, res) => {
  db.all("SELECT * FROM clientes ORDER BY nome ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.get("/api/clientes/:id", (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM clientes WHERE id = ?", [id], (err, cliente) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado" });

    // Buscar histórico de leituras
    db.all("SELECT * FROM leituras WHERE cliente_id = ? ORDER BY data DESC", [id], (err, leituras) => {
      if (err) return res.status(500).json({ error: err.message });

      // Buscar histórico de talões
      db.all("SELECT * FROM taloes WHERE cliente_id = ? ORDER BY id DESC", [id], (err, taloes) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ cliente, leituras: leituras || [], taloes: taloes || [] });
      });
    });
  });
});

app.post("/api/clientes", (req, res) => {
  const { nome, endereco, poco, hidrometro } = req.body;
  if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });
  
  db.run(
    "INSERT INTO clientes (nome, endereco, poco, hidrometro) VALUES (?, ?, ?, ?)",
    [nome, endereco || "", poco || "Poço 1", hidrometro || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put("/api/clientes/:id", (req, res) => {
  const { id } = req.params;
  const { nome, endereco, poco, hidrometro } = req.body;
  if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });

  db.run(
    "UPDATE clientes SET nome = ?, endereco = ?, poco = ?, hidrometro = ? WHERE id = ?",
    [nome, endereco, poco, hidrometro, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete("/api/clientes/:id", (req, res) => {
  const { id } = req.params;
  db.serialize(() => {
    db.run("DELETE FROM taloes WHERE cliente_id = ?", [id]);
    db.run("DELETE FROM leituras WHERE cliente_id = ?", [id]);
    db.run("DELETE FROM clientes WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// 💧 Leituras
app.get("/api/leituras", (req, res) => {
  db.all(
    `SELECT l.*, c.nome as cliente_nome, c.poco as cliente_poco 
     FROM leituras l 
     JOIN clientes c ON l.cliente_id = c.id 
     ORDER BY l.data DESC, l.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.post("/api/leituras", (req, res) => {
  const { cliente_id, leitura_atual, data } = req.body;
  if (!cliente_id || leitura_atual === undefined || !data) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  const leituraAtualNum = parseFloat(leitura_atual);

  // 1. Buscar a última leitura deste cliente para servir como anterior
  db.get(
    "SELECT leitura_atual FROM leituras WHERE cliente_id = ? ORDER BY data DESC, id DESC LIMIT 1",
    [cliente_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      const leitura_anterior = row ? parseFloat(row.leitura_atual) : 0;
      const consumo = leituraAtualNum - leitura_anterior;

      if (consumo < 0) {
        return res.status(400).json({
          error: `A leitura atual (${leituraAtualNum}) não pode ser menor que a anterior (${leitura_anterior}).`
        });
      }

      // 2. Buscar valor atual do metro cúbico nas configurações
      db.get("SELECT valor FROM configuracoes WHERE chave = 'valor_m3'", (err, config) => {
        if (err) return res.status(500).json({ error: err.message });

        const valor_m3 = config ? parseFloat(config.valor) : 5.00;
        const valor_total = consumo * valor_m3;
        const vencimento = calcularVencimento(data);

        db.serialize(() => {
          // 3. Inserir leitura
          db.run(
            `INSERT INTO leituras (cliente_id, leitura_anterior, leitura_atual, consumo, data)
             VALUES (?, ?, ?, ?, ?)`,
            [cliente_id, leitura_anterior, leituraAtualNum, consumo, data],
            function (err) {
              if (err) return res.status(500).json({ error: err.message });

              const leitura_id = this.lastID;

              // 4. Inserir talão correspondente de forma automatizada
              db.run(
                `INSERT INTO taloes (cliente_id, leitura_id, valor, valor_m3, status, data_vencimento)
                 VALUES (?, ?, ?, ?, 'pendente', ?)`,
                [cliente_id, leitura_id, valor_total, valor_m3, vencimento],
                function (err) {
                  if (err) return res.status(500).json({ error: err.message });

                  res.json({
                    success: true,
                    leitura_id,
                    talao_id: this.lastID,
                    consumo,
                    valor: valor_total,
                    data_vencimento: vencimento
                  });
                }
              );
            }
          );
        });
      });
    }
  );
});

// 💰 Talões
app.get("/api/taloes", (req, res) => {
  db.all(
    `SELECT t.*, 
            c.nome as cliente_nome, 
            c.endereco as cliente_endereco, 
            c.poco as cliente_poco, 
            c.hidrometro as cliente_hidrometro, 
            l.leitura_anterior, 
            l.leitura_atual, 
            l.consumo, 
            l.data as data_leitura
     FROM taloes t 
     JOIN clientes c ON t.cliente_id = c.id 
     JOIN leituras l ON t.leitura_id = l.id 
     ORDER BY t.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.put("/api/taloes/:id/pago", (req, res) => {
  const { id } = req.params;
  const { tipo_pagamento } = req.body;
  db.run("UPDATE taloes SET status = 'pago', tipo_pagamento = ? WHERE id = ?", [tipo_pagamento || "pix", id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.put("/api/taloes/:id/pendente", (req, res) => {
  const { id } = req.params;
  db.run("UPDATE taloes SET status = 'pendente', tipo_pagamento = NULL WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete("/api/taloes/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM taloes WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ⚙️ Configurações
app.get("/api/config", (req, res) => {
  db.all("SELECT * FROM configuracoes", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const configs = {};
    rows.forEach((row) => {
      configs[row.chave] = row.valor;
    });

    // Valores padrão se não existirem no banco de dados
    if (!configs.valor_m3) configs.valor_m3 = "5.00";
    if (!configs.talao_empresa) configs.talao_empresa = "AquaControl";
    if (!configs.talao_subtitulo) configs.talao_subtitulo = "Serviço Particular de Água & Saneamento";
    if (!configs.talao_pix_key) configs.talao_pix_key = "financeiro@aquacontrol.com.br";
    if (!configs.talao_pix_cidade) configs.talao_pix_cidade = "Sao Paulo";
    if (!configs.talao_mensagem) configs.talao_mensagem = "Agradecemos a colaboração!";
    if (!configs.talao_layout_padrao) configs.talao_layout_padrao = "detailed";
    if (!configs.talao_cor_primaria) configs.talao_cor_primaria = "#2b6cb0";

    res.json(configs);
  });
});

app.post("/api/config", (req, res) => {
  const configs = req.body;
  if (!configs || Object.keys(configs).length === 0) {
    return res.status(400).json({ error: "Nenhuma configuração fornecida" });
  }

  db.serialize(() => {
    let errorOccurred = false;
    const stmt = db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)");
    
    for (const [chave, valor] of Object.entries(configs)) {
      let finalValor = valor;
      if (chave === "valor_m3" && valor !== undefined) {
        finalValor = parseFloat(valor).toFixed(2);
      }
      
      stmt.run(chave, finalValor !== null && finalValor !== undefined ? finalValor.toString() : "", (err) => {
        if (err) {
          console.error(`Erro ao salvar config ${chave}:`, err);
          errorOccurred = true;
        }
      });
    }

    stmt.finalize((err) => {
      if (err || errorOccurred) {
        return res.status(500).json({ error: "Erro ao salvar as configurações." });
      }
      res.json({ success: true });
    });
  });
});

// 📈 Métricas do Dashboard
app.get("/api/dashboard", (req, res) => {
  const metrics = {};

  // Total de clientes
  db.get("SELECT COUNT(*) as count FROM clientes", (err, row) => {
    metrics.total_clientes = row ? row.count : 0;

    // Total arrecadado (pago)
    db.get("SELECT SUM(valor) as sum FROM taloes WHERE status = 'pago'", (err, row) => {
      metrics.total_arrecadado = row && row.sum ? parseFloat(row.sum) : 0;

      // Total arrecadado via Pix
      db.get("SELECT SUM(valor) as sum FROM taloes WHERE status = 'pago' AND tipo_pagamento = 'pix'", (err, rowPix) => {
        metrics.total_pix = rowPix && rowPix.sum ? parseFloat(rowPix.sum) : 0;

        // Total arrecadado Presencialmente
        db.get("SELECT SUM(valor) as sum FROM taloes WHERE status = 'pago' AND tipo_pagamento = 'presencial'", (err, rowPresencial) => {
          metrics.total_presencial = rowPresencial && rowPresencial.sum ? parseFloat(rowPresencial.sum) : 0;

          // Total pendente
          db.get("SELECT SUM(valor) as sum FROM taloes WHERE status = 'pendente'", (err, row) => {
            metrics.total_pendente = row && row.sum ? parseFloat(row.sum) : 0;

            // Inadimplentes (clientes com pelo menos 1 talão pendente vencido)
            const hojeStr = new Date().toISOString().split("T")[0];
            db.get(
              "SELECT COUNT(DISTINCT cliente_id) as count FROM taloes WHERE status = 'pendente' AND data_vencimento < ?",
              [hojeStr],
              (err, row) => {
                metrics.total_inadimplentes = row ? row.count : 0;

                // Histórico mensal (últimos 6 meses de faturamento e consumo)
                db.all(
                  `SELECT SUBSTR(l.data, 1, 7) as mes, 
                          SUM(l.consumo) as consumo, 
                          SUM(t.valor) as faturamento 
                   FROM taloes t 
                   JOIN leituras l ON t.leitura_id = l.id 
                   GROUP BY mes 
                   ORDER BY mes ASC 
                   LIMIT 6`,
                  [],
                  (err, rows) => {
                    metrics.historico_mensal = rows || [];

                    // Estatísticas por poço (clientes e consumo acumulado)
                    db.all(
                      `SELECT c.poco, 
                              COUNT(DISTINCT c.id) as clientes, 
                              SUM(l.consumo) as consumo
                       FROM clientes c 
                       LEFT JOIN leituras l ON c.id = l.cliente_id 
                       GROUP BY c.poco`,
                      [],
                      (err, rows) => {
                        metrics.poco_stats = rows || [];
                        res.json(metrics);
                      }
                    );
                  }
                );
              }
            );
          });
        });
      });
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

