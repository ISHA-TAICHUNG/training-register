/* 報名多步驟前端控制器
 *
 * XSS 安全策略：
 * 1. 所有使用者輸入與檔名經 escape() 函式做 HTML entity encoding
 * 2. 所有動態 HTML 透過 renderHTML() 輔助函式以 Range.createContextualFragment 注入
 * 3. 載入 DOMPurify（CDN）作為第二道防線，任何含使用者資料的 HTML 先通過 sanitize
 * 4. form 輸入值用 value attribute 綁定並 escape，避免 attribute injection
 * 5. courses.json / qualifications.json 為我方託管靜態資料，視為可信來源但仍經 escape()
 */
(async function () {
  const state = State.load();
  let COURSES = null;
  let QUALS = null;

  // --- 安全渲染輔助 ---
  function purify(html) {
    if (window.DOMPurify) return window.DOMPurify.sanitize(html);
    return html; // fallback：escape() 已處理使用者資料
  }
  function renderHTML(el, html) {
    const safe = purify(html);
    const range = document.createRange();
    const frag = range.createContextualFragment(safe);
    el.replaceChildren(frag);
  }

  // --- 載入資料 ---
  try {
    [COURSES, QUALS] = await Promise.all([
      fetch("data/courses.json").then(r => r.json()),
      fetch("data/qualifications.json").then(r => r.json()),
    ]);
  } catch (e) {
    renderHTML(document.getElementById("app"),
      `<div class="card"><div class="notice notice-warn">載入資料失敗，請重新整理。</div></div>`);
    return;
  }

  const app = document.getElementById("app");

  // 嘗試預取名額資訊（非阻塞，失敗不影響流程）
  let COURSES_STATUS = null;
  API.fetchCoursesStatus().then(s => {
    COURSES_STATUS = s;
    // 若目前正在 Step 1，重新 render 以顯示名額
    if (state.step === 1 && window.__rerenderStep1) window.__rerenderStep1();
  });

  function updateProgress(n) {
    document.querySelectorAll(".step").forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.toggle("active", s === n);
      el.classList.toggle("done", s < n);
    });
  }

  function go(step) {
    state.step = step;
    State.save(state);
    window.scrollTo(0, 0);
    updateProgress(step);
    if (step === 1) renderStep1();
    else if (step === 2) renderStep2();
    else if (step === 3) renderStep3();
    else if (step === 4) renderStep4();
  }

  // ========== STEP 1：選課程 ==========
  function renderStep1() {
    const all = [...COURSES.training, ...COURSES.seminars];
    const catMap = new Map();
    all.forEach(c => {
      if (!catMap.has(c.cat)) catMap.set(c.cat, []);
      catMap.get(c.cat).push(c);
    });
    const cats = [...catMap.keys()];
    let activeCat = state.course ? state.course.cat : cats[0];

    const renderCourseList = () => {
      const items = catMap.get(activeCat) || [];
      return items.map(c => {
        const selected = state.course && state.course.id === c.id;
        const nightTag = c.class_kind === "night" ? `<span class="tag-night">夜</span>` : "";
        const st = COURSES_STATUS && COURSES_STATUS[c.id];
        const disabled = st && (st.status === "full" || st.status === "closed");
        let seatBadge;
        if (!st) {
          seatBadge = `<span class="seat-badge seat-loading">名額查詢中</span>`;
        } else if (st.status === "full") {
          seatBadge = `<span class="seat-badge seat-full">已額滿</span>`;
        } else if (st.status === "closed") {
          seatBadge = `<span class="seat-badge seat-closed">已停止報名</span>`;
        } else if (st.status === "low") {
          seatBadge = `<span class="seat-badge seat-low">剩 ${st.remaining} 席</span>`;
        } else {
          seatBadge = `<span class="seat-badge seat-open">剩 ${st.remaining} 席</span>`;
        }
        return `
          <div class="course-item ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}" data-id="${escape(c.id)}">
            <div class="course-title-row">
              <div class="course-name">${escape(c.name)}${nightTag}</div>
              <div class="course-session">${escape(c.session)}</div>
            </div>
            <div class="course-meta">
              <span>📍 ${escape(c.location)}</span>
              <span>📅 ${escape(c.date)}</span>
              ${c.practicum ? `<span>🔧 ${escape(c.practicum)}</span>` : ""}
              ${seatBadge}
            </div>
          </div>`;
      }).join("");
    };

    const render = () => {
      renderHTML(app, `
        <div class="card">
          <h2>選擇課程</h2>
          <div class="sub">全 60 場 · 點類別切換</div>
          <div class="cat-tabs">
            ${cats.map(c => {
              const items = catMap.get(c) || [];
              const shortName = (items[0] && items[0].cat_short) || c;
              return `<div class="cat-tab ${c === activeCat ? "active" : ""}" data-cat="${escape(c)}">${escape(shortName)}<span class="count">${items.length}</span></div>`;
            }).join("")}
          </div>
          <div id="course-list">${renderCourseList()}</div>
        </div>
        <div class="btn-bar">
          <button class="btn btn-ghost" id="btn-home">返回首頁</button>
          <button class="btn btn-primary" id="btn-next" ${state.course ? "" : "disabled"}>下一步：勾選資格 →</button>
        </div>
      `);

      document.getElementById("btn-home").addEventListener("click", () => { location.href = "index.html"; });
      app.querySelectorAll(".cat-tab").forEach(t => {
        t.addEventListener("click", () => { activeCat = t.dataset.cat; render(); });
      });
      app.querySelectorAll(".course-item").forEach(item => {
        item.addEventListener("click", () => {
          if (item.classList.contains("disabled")) {
            alert("此課程已額滿或已停止報名，請選擇其他課程");
            return;
          }
          const id = item.dataset.id;
          state.course = all.find(c => c.id === id);
          State.save(state);
          render();
        });
      });
      document.getElementById("btn-next").addEventListener("click", () => {
        if (!state.course) { alert("請先選擇課程"); return; }
        // 送出前檢查選定課程是否仍可報名
        const st = COURSES_STATUS && COURSES_STATUS[state.course.id];
        if (st && (st.status === "full" || st.status === "closed")) {
          alert("此課程已額滿或已停止報名，請選擇其他課程");
          state.course = null;
          State.save(state);
          render();
          return;
        }
        go(2);
      });
    };
    // 讓外部（名額載入完畢）能觸發重繪
    window.__rerenderStep1 = render;
    render();
  }

  // ========== STEP 2：勾選資格 ==========
  function renderStep2() {
    const basicIds = QUALS.basic.map(q => q.id);

    const qualItemHTML = (q, checked) => `
      <div class="qual-item ${checked ? "checked" : ""}" data-qid="${escape(q.id)}">
        <div class="qual-check"></div>
        <div class="qual-content">
          <div class="qual-label">${escape(q.label)}</div>
          <div class="qual-desc">${escape(q.description)}</div>
          <div class="qual-files">
            ${q.required_files.map(f => `<span>📎 ${escape(f.label)}</span>`).join("")}
          </div>
        </div>
      </div>`;

    const render = () => {
      renderHTML(app, `
        <div class="card">
          <h2>勾選身份與資格</h2>
          <div class="sub">依你實際身份勾選，每項將對應需上傳的佐證文件。</div>

          <div class="notice notice-info">
            <strong>已選課程：</strong>${escape(state.course.name)} ${escape(state.course.session)}
            <br><strong>日期：</strong>${escape(state.course.date)}　<strong>地點：</strong>${escape(state.course.location)}
          </div>

          <div class="form-group-title" style="margin-top:16px">一、基本資格（請選擇你的身份，至少 1 項）<span class="req">★</span></div>
          <div class="qual-list">
            ${QUALS.basic.map(q => qualItemHTML(q, state.qualifications.includes(q.id))).join("")}
          </div>

          <div class="form-group-title" style="margin-top:20px">二、優先錄取資格（可複選，可不選）</div>
          <div style="font-size:12px;color:#666;margin-bottom:8px">具下列資格者，報名人數超額時優先錄取。</div>
          <div class="qual-list">
            ${QUALS.priority.map(q => qualItemHTML(q, state.qualifications.includes(q.id))).join("")}
          </div>
        </div>

        <div class="btn-bar">
          <button class="btn btn-ghost" id="btn-back">上一步</button>
          <button class="btn btn-primary" id="btn-next">下一步:上傳文件 →</button>
        </div>
      `);

      app.querySelectorAll(".qual-item").forEach(item => {
        item.addEventListener("click", () => {
          const qid = item.dataset.qid;
          const idx = state.qualifications.indexOf(qid);
          if (idx >= 0) state.qualifications.splice(idx, 1);
          else state.qualifications.push(qid);
          State.save(state);
          render();
        });
      });
      document.getElementById("btn-back").addEventListener("click", () => go(1));
      document.getElementById("btn-next").addEventListener("click", () => {
        const hasBasic = state.qualifications.some(id => basicIds.includes(id));
        if (!hasBasic) {
          alert("請先選擇你的基本資格：臺中市市民 或 臺中市工作者");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        go(3);
      });
    };
    render();
  }

  // ========== STEP 3：上傳文件 ==========
  function renderStep3() {
    // 依 state.qualifications（已勾選的資格）動態產生上傳欄位
    // 每個資格的每個 required_file 各自一個上傳格（例：身分證正面、身分證反面分開）
    const allQuals = [...QUALS.basic, ...QUALS.priority];
    const selectedQuals = state.qualifications
      .map(id => allQuals.find(q => q.id === id))
      .filter(Boolean);

    const basicIds = QUALS.basic.map(q => q.id);

    // 展開為所有必上傳的「檔案格」
    const allGroups = [];
    selectedQuals.forEach(q => {
      q.required_files.forEach(f => {
        allGroups.push({
          id: `qual_${q.id}_${f.id}`,
          qualLabel: q.label,
          fileLabel: f.label,
          isBasic: basicIds.includes(q.id),
        });
      });
    });

    // 清除不再需要的檔案（改身份後）
    const neededGroups = allGroups.map(g => g.id);
    Object.keys(state.files).forEach(k => { if (!neededGroups.includes(k)) delete state.files[k]; });

    const render = () => {
      renderHTML(app, `
        <div class="card">
          <h2>上傳證明文件</h2>
          <div class="sub">支援 JPG、PNG、PDF 或手機拍照，單檔不超過 10 MB。請務必上傳清晰可辨識的檔案。</div>
          <div>
            ${allGroups.map(g => `
              <div class="upload-group" data-gid="${escape(g.id)}">
                <div class="upload-group-title">
                  ${g.isBasic ? '<span style="background:#0057B8;color:white;font-size:10px;padding:2px 6px;border-radius:3px;letter-spacing:1px">基本</span>' : ''}
                  <span>${escape(g.fileLabel)}</span>
                </div>
                <div class="upload-group-desc">資格：${escape(g.qualLabel)}</div>

                <div class="file-list">
                  ${(state.files[g.id] || []).map((f, i) => `
                    <div class="file-item">
                      <span class="icon">✓</span>
                      <span class="name">${escape(f.name)}</span>
                      <span class="size">${formatSize(f.size)}</span>
                      <span class="remove" data-gid="${escape(g.id)}" data-idx="${i}">✕ 移除</span>
                    </div>
                  `).join("")}
                </div>

                <label class="upload-btn upload-btn-single" data-gid="${escape(g.id)}">
                  <div class="ub-icon">📷 📎</div>
                  <div class="ub-label">上傳檔案 或 拍照</div>
                  <div class="ub-hint">手機可選擇相機、相簿或檔案；支援 JPG / PNG / PDF，≤ 10MB</div>
                  <input type="file" accept="${escape(CONFIG.FILE_ACCEPT_EXT)}" multiple data-gid="${escape(g.id)}">
                </label>
              </div>
            `).join("")}
          </div>
        </div>
        <div class="btn-bar">
          <button class="btn btn-ghost" id="btn-back">上一步</button>
          <button class="btn btn-primary" id="btn-next">下一步：填寫資料 →</button>
        </div>
      `);

      // 單一 input：手機自動彈相機/相簿/檔案選單；桌機是檔案選擇器
      document.querySelectorAll('.upload-btn input[type="file"]').forEach(input => {
        input.addEventListener("change", (e) => {
          onFiles(e, input.dataset.gid);
          e.target.value = "";
        });
      });
      // 桌機拖曳支援
      document.querySelectorAll(".upload-btn-single").forEach(btn => {
        btn.addEventListener("dragover", (e) => { e.preventDefault(); btn.classList.add("dragover"); });
        btn.addEventListener("dragleave", () => btn.classList.remove("dragover"));
        btn.addEventListener("drop", (e) => {
          e.preventDefault();
          btn.classList.remove("dragover");
          onFiles({ target: { files: e.dataTransfer.files } }, btn.dataset.gid);
        });
      });
      // 移除檔案
      document.querySelectorAll(".file-item .remove").forEach(btn => {
        btn.addEventListener("click", () => {
          const gid = btn.dataset.gid;
          const idx = parseInt(btn.dataset.idx);
          state.files[gid].splice(idx, 1);
          if (state.files[gid].length === 0) delete state.files[gid];
          State.save(state);
          render();
        });
      });

      document.getElementById("btn-back").addEventListener("click", () => go(2));
      document.getElementById("btn-next").addEventListener("click", () => {
        const missing = allGroups.filter(g => !state.files[g.id] || state.files[g.id].length === 0);
        if (missing.length > 0) {
          alert("以下尚未上傳：\n\n" + missing.map(g => `• ${g.qualLabel} — ${g.fileLabel}`).join("\n"));
          return;
        }
        go(4);
      });
    };

    async function onFiles(e, gid) {
      const files = Array.from(e.target.files || []);
      const grp = allGroups.find(g => g.id === gid);
      const fileLabel = grp ? grp.fileLabel : gid;
      for (const f of files) {
        if (!Validate.fileType(f)) { alert(`不支援的檔案類型：${f.name}\n僅支援 JPG、PNG、PDF`); continue; }
        if (!Validate.fileSize(f)) { alert(`檔案過大：${f.name}\n單檔不得超過 10 MB`); continue; }
        const b64 = await API.fileToBase64(f);
        if (!state.files[gid]) state.files[gid] = [];
        state.files[gid].push({
          name: f.name,
          size: f.size,
          type: f.type,
          base64: b64,
          label: fileLabel,   // 佐證標籤，Apps Script 用來組 Drive 檔名
        });
      }
      State.save(state);
      render();
    }

    render();
  }

  // ========== STEP 4：填寫報名資料 ==========
  function renderStep4() {
    const f = state.form || {};
    const isTraining = state.course && state.course.type === "訓練";
    renderHTML(app, `
      <div class="card">
        <h2>填寫報名資料</h2>
        <div class="sub">本資料將作為承辦單位匯入原系統使用，請確實填寫。<span style="color:#C41E3A">★ 為必填</span></div>
        ${isTraining ? `
        <div class="notice notice-warn" style="margin-bottom:14px">
          <strong>提醒：</strong>每人限報 2 門訓練課程（依身分證認定）。若已超過上限，送出時系統會通知。職安衛宣導會不受此限制。
        </div>
        ` : ''}
        <form id="reg-form" novalidate>
          <input type="text" name="website" class="honeypot" tabindex="-1" autocomplete="off">

          <div class="form-group-title">一、個人基本資料</div>
          <div class="form-2col">
            <div class="form-row" data-field="name">
              <label>姓名 <span class="req">★</span></label>
              <input type="text" name="name" value="${escape(f.name || '')}" required>
              <div class="err">請填寫姓名</div>
            </div>
            <div class="form-row" data-field="gender">
              <label>性別 <span class="req">★</span></label>
              <select name="gender" required>
                <option value="">請選擇</option>
                <option value="男" ${f.gender === '男' ? 'selected' : ''}>男</option>
                <option value="女" ${f.gender === '女' ? 'selected' : ''}>女</option>
              </select>
              <div class="err">請選擇性別</div>
            </div>
          </div>
          <div class="form-2col">
            <div class="form-row" data-field="birthday">
              <label>生日（民國 yyymmdd） <span class="req">★</span></label>
              <input type="text" name="birthday" placeholder="例：0750101" value="${escape(f.birthday || '')}" maxlength="7" required>
              <div class="hint">7 碼數字，例 0750101 = 民國 75 年 1 月 1 日</div>
              <div class="err">生日格式錯誤</div>
            </div>
            <div class="form-row" data-field="id_card">
              <label>身分證字號 <span class="req">★</span></label>
              <input type="text" name="id_card" placeholder="A123456789" value="${escape(f.id_card || '')}" maxlength="10" required style="text-transform:uppercase">
              <div class="err">身分證格式錯誤</div>
            </div>
          </div>
          <div class="form-2col">
            <div class="form-row" data-field="mobile">
              <label>手機 <span class="req">★</span></label>
              <input type="tel" name="mobile" placeholder="09xxxxxxxx" value="${escape(f.mobile || '')}" required>
              <div class="err">手機格式錯誤</div>
            </div>
            <div class="form-row" data-field="email">
              <label>電子郵件</label>
              <input type="email" name="email" placeholder="you@example.com" value="${escape(f.email || '')}">
              <div class="err">Email 格式錯誤</div>
            </div>
          </div>
          <div class="form-row" data-field="education">
            <label>學歷</label>
            <select name="education">
              <option value="">請選擇</option>
              ${["國小","國中","高中","高職","專科","大學","研究所"].map(v =>
                `<option value="${escape(v)}" ${f.education === v ? 'selected' : ''}>${escape(v)}</option>`).join("")}
            </select>
          </div>
          <div class="form-row" data-field="school">
            <label>畢業學校</label>
            <input type="text" name="school" value="${escape(f.school || '')}">
          </div>

          <div class="form-group">
            <div class="form-group-title">二、聯絡資訊</div>
            <div class="form-2col">
              <div class="form-row" data-field="contact_zip">
                <label>聯絡地址郵遞區號</label>
                <input type="text" name="contact_zip" maxlength="6" placeholder="例：403" value="${escape(f.contact_zip || '')}">
              </div>
              <div class="form-row" data-field="contact_phone">
                <label>市話</label>
                <input type="text" name="contact_phone" placeholder="例：04-23710633" value="${escape(f.contact_phone || '')}">
              </div>
            </div>
            <div class="form-row" data-field="contact_addr">
              <label>聯絡地址</label>
              <input type="text" name="contact_addr" placeholder="例：臺中市西區..." value="${escape(f.contact_addr || '')}">
            </div>
            <div class="form-2col">
              <div class="form-row" data-field="emergency_name">
                <label>緊急聯絡人</label>
                <input type="text" name="emergency_name" value="${escape(f.emergency_name || '')}">
              </div>
              <div class="form-row" data-field="emergency_phone">
                <label>緊急聯絡人電話</label>
                <input type="tel" name="emergency_phone" value="${escape(f.emergency_phone || '')}">
              </div>
            </div>
          </div>

          <div class="form-group">
            <div class="form-group-title">三、任職單位（如適用）</div>
            <div class="form-2col">
              <div class="form-row" data-field="company_name">
                <label>公司名稱</label>
                <input type="text" name="company_name" value="${escape(f.company_name || '')}">
              </div>
              <div class="form-row" data-field="company_tax">
                <label>公司統編</label>
                <input type="text" name="company_tax" maxlength="8" value="${escape(f.company_tax || '')}">
              </div>
            </div>
            <div class="form-row" data-field="company_addr">
              <label>公司地址</label>
              <input type="text" name="company_addr" value="${escape(f.company_addr || '')}">
            </div>
            <div class="form-2col">
              <div class="form-row" data-field="company_phone">
                <label>公司電話</label>
                <input type="text" name="company_phone" value="${escape(f.company_phone || '')}">
              </div>
              <div class="form-row" data-field="position">
                <label>現任職務</label>
                <input type="text" name="position" value="${escape(f.position || '')}">
              </div>
            </div>
          </div>

          <div class="form-group">
            <div class="form-group-title">四、補充（選填）</div>
            ${state.course.type === "宣導會" ? `
              <div class="notice notice-info" style="font-size:12px;margin-bottom:10px">
                <strong>回訓證明專用：</strong>若需領取回訓證明，請填寫原結業證書證號（技術士證號）並上傳證書影本。
                如不需回訓證明，此區可略過。
              </div>
              <div class="form-row" data-field="prev_cert">
                <label>原結業證書證號（技術士證號）</label>
                <input type="text" name="prev_cert" value="${escape(f.prev_cert || '')}" placeholder="例：安良中X證字第12345號　或　技術士總編號 151-12345">
              </div>
              <div class="form-row">
                <label>上傳證書影本</label>
                <div class="file-list" id="cert-file-list">
                  ${(state.files.qual_cert || []).map((f, i) => `
                    <div class="file-item">
                      <span class="icon">✓</span>
                      <span class="name">${escape(f.name)}</span>
                      <span class="size">${formatSize(f.size)}</span>
                      <span class="remove-cert" data-idx="${i}">✕ 移除</span>
                    </div>
                  `).join("")}
                </div>
                <label class="upload-btn upload-btn-single">
                  <div class="ub-icon">📷 📎</div>
                  <div class="ub-label">上傳檔案 或 拍照</div>
                  <div class="ub-hint">手機可選擇相機、相簿或檔案</div>
                  <input type="file" id="file-cert" accept="${escape(CONFIG.FILE_ACCEPT_EXT)}" multiple>
                </label>
              </div>
            ` : ``}
            <div class="form-row" data-field="note">
              <label>備註</label>
              <textarea name="note" rows="2" placeholder="如有特殊說明請於此填寫">${escape(f.note || '')}</textarea>
            </div>
          </div>
        </form>
        <div class="notice notice-warn" style="margin-top:16px">
          <strong>個資保護聲明：</strong>本表單所蒐集之個人資料僅供本訓練甄審與訓練管理使用，
          依《個人資料保護法》妥適保管，訓練結束後依規定銷毀。
        </div>
      </div>
      <div class="btn-bar">
        <button class="btn btn-ghost" id="btn-back">上一步</button>
        <button class="btn btn-primary" id="btn-submit">送出報名 ✓</button>
      </div>
    `);

    document.getElementById("btn-back").addEventListener("click", () => { collectForm(); go(3); });
    document.getElementById("btn-submit").addEventListener("click", submitRegistration);

    // 宣導會專屬：證書上傳
    if (state.course.type === "宣導會") {
      const fileInput = document.getElementById("file-cert");
      const certList = document.getElementById("cert-file-list");

      const renderCertList = () => {
        if (!certList) return;
        const files = state.files.qual_cert || [];
        certList.replaceChildren();
        files.forEach((fl, i) => {
          const item = document.createElement("div");
          item.className = "file-item";
          const icon = document.createElement("span"); icon.className = "icon"; icon.textContent = "✓";
          const name = document.createElement("span"); name.className = "name"; name.textContent = fl.name;
          const size = document.createElement("span"); size.className = "size"; size.textContent = formatSize(fl.size);
          const rm = document.createElement("span"); rm.className = "remove"; rm.textContent = "✕ 移除";
          rm.addEventListener("click", () => {
            state.files.qual_cert.splice(i, 1);
            if (state.files.qual_cert.length === 0) delete state.files.qual_cert;
            State.save(state);
            renderCertList();
          });
          item.append(icon, name, size, rm);
          certList.append(item);
        });
      };

      const handleCertFiles = async (files) => {
        for (const f of Array.from(files || [])) {
          if (!Validate.fileType(f)) { alert(`不支援的檔案類型：${f.name}`); continue; }
          if (!Validate.fileSize(f)) { alert(`檔案過大：${f.name}`); continue; }
          const b64 = await API.fileToBase64(f);
          if (!state.files.qual_cert) state.files.qual_cert = [];
          state.files.qual_cert.push({
            name: f.name, size: f.size, type: f.type, base64: b64,
            label: "回訓證書",
          });
        }
        State.save(state);
        renderCertList();
      };

      if (fileInput) fileInput.addEventListener("change", (e) => {
        handleCertFiles(e.target.files);
        e.target.value = "";
      });
    }
  }

  function collectForm() {
    const form = document.getElementById("reg-form");
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    state.form = data;
    State.save(state);
    return data;
  }

  function validateForm(f) {
    const errors = [];
    if (!Validate.name(f.name)) errors.push(["name", "請填寫姓名"]);
    if (!f.gender) errors.push(["gender", "請選擇性別"]);
    if (!Validate.rocDate(f.birthday)) errors.push(["birthday", "生日格式錯誤（7 碼民國年月日）"]);
    if (!Validate.idCard(f.id_card)) errors.push(["id_card", "身分證字號格式不正確"]);
    if (!Validate.phone(f.mobile)) errors.push(["mobile", "手機格式錯誤"]);
    if (f.email && !Validate.email(f.email)) errors.push(["email", "Email 格式錯誤"]);
    if (f.company_tax && !Validate.taxId(f.company_tax)) errors.push(["company_tax", "統編需為 8 碼數字"]);
    return errors;
  }

  async function submitRegistration() {
    const f = collectForm();
    // 反機器人
    if (f.website) { alert("送出失敗"); return; }
    const elapsed = Date.now() - state.startTime;
    if (elapsed < CONFIG.MIN_FILL_TIME_MS) { alert("送出過快，請確認資料後再送出"); return; }

    document.querySelectorAll(".form-row.has-error").forEach(el => el.classList.remove("has-error"));
    const errors = validateForm(f);
    if (errors.length) {
      errors.forEach(([field, msg]) => {
        const row = document.querySelector(`.form-row[data-field="${field}"]`);
        if (row) {
          row.classList.add("has-error");
          const err = row.querySelector(".err");
          if (err) err.textContent = msg;
        }
      });
      const first = document.querySelector(".form-row.has-error");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const btn = document.getElementById("btn-submit");
    btn.disabled = true;
    btn.textContent = "送出中…";

    try {
      const payload = {
        course: state.course,
        qualifications: state.qualifications,
        files: state.files,
        form: state.form,
        submittedAt: new Date().toISOString(),
      };
      const res = await API.submitRegistration(payload);
      sessionStorage.setItem("last_submission", JSON.stringify({
        regId: res.regId,
        course: state.course,
        name: f.name,
      }));
      State.clear();
      location.href = "done.html";
    } catch (e) {
      alert("送出失敗：" + e.message + "\n\n您的資料已保留，請稍後再試");
      btn.disabled = false;
      btn.textContent = "送出報名 ✓";
    }
  }

  function escape(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function formatSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  const startStep = Math.max(1, state.step || 1);
  go(startStep);
})();
