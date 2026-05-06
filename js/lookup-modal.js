/* 報名狀態查詢 Modal — index.html / done.html 共用 */
(function () {
  // 6 種狀態的親切訊息
  const STATUS_MESSAGES = {
    "待審": {
      icon: "⏳",
      title: "我們收到您的報名囉！",
      msg: "您的資料正在審查中，承辦人員會仔細確認您的證明文件。\n\n請耐心等候 🙏",
    },
    "通過": {
      icon: "✅",
      title: "恭喜您！審核通過 🎊",
      msg: "您的資格已通過審核！\n\n請耐心等待承辦登錄至本中心系統！",
    },
    "已匯出": {
      icon: "🎉",
      title: "您已成功登錄至本中心系統！",
      msg: "太棒了！您的報名已完成所有審核流程，正在為您自動跳轉至本中心系統頁面...\n\n如未自動跳轉，請點下方按鈕。",
    },
    "補件": {
      icon: "📝",
      title: "您的資料需要補件",
      msg: "我們在審查您的資料時發現需要您補充一些文件。\n\n請主動與本中心聯繫，我們會協助您完成補件。\n\n" + getContactLines(),
    },
    "拒絕": {
      icon: "💌",
      title: "很抱歉，您資格不符",
      msg: "如有問題請洽本中心：\n\n" + getContactLines(),
    },
    "取消": {
      icon: "ℹ️",
      title: "您的報名已取消",
      msg: "您的這次報名已被取消。\n\n如非您本人申請取消，或有任何疑問，請儘速與本中心聯繫確認。\n\n" + getContactLines(),
    },
  };

  const NOT_FOUND = {
    icon: "🔍",
    title: "查無此筆報名資料",
    msg: "請確認您輸入的姓名與身分證後 5 碼是否正確。\n\n如果還沒報名過，請點擊「立即報名」開始報名 😊\n\n如有疑問，請聯繫本中心：\n" + getContactLines(),
  };

  // 三教室電話統一格式（單筆 / 多筆訊息共用，避免不一致）
  function getContactLines() {
    return "📞 復興教室　04-22249535\n📞 忠明教室　04-22608999\n📞 龍井教室　04-26336999";
  }

  let modal = null;
  let elements = {};
  let exportTimerId = null;  // P1：「已匯出」的 setTimeout id，close() 要清掉避免關閉後仍跳轉

  // helper：建立元素 + 設定 style/attrs/textContent
  function el(tag, opts) {
    const e = document.createElement(tag);
    if (!opts) return e;
    if (opts.style) Object.assign(e.style, opts.style);
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (opts.text != null) e.textContent = opts.text;
    if (opts.children) opts.children.forEach(c => e.appendChild(c));
    return e;
  }

  function buildModal() {
    if (modal) return;

    const titleSpan = el("span", { text: "查詢報名狀態" });
    const errorBox = el("div", { style: { color: "#c0392b", fontSize: "13px", marginTop: "10px", display: "none" } });

    const nameInput = el("input", {
      attrs: { type: "text", placeholder: "例：王小明" },
      style: { width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "15px", boxSizing: "border-box", fontFamily: "inherit" },
    });
    const id5Input = el("input", {
      attrs: { type: "text", placeholder: "例：23456", maxlength: "5", inputmode: "numeric", pattern: "\\d{5}" },
      style: { width: "100%", padding: "10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "15px", boxSizing: "border-box", fontFamily: "inherit", letterSpacing: "2px", textAlign: "center" },
    });

    const formArea = el("div", {
      children: [
        el("p", { style: { marginBottom: "16px", color: "#666", fontSize: "13px" }, text: "請輸入您的姓名與身分證後 5 碼，查詢目前的報名狀態。" }),
        el("label", {
          style: { display: "block", marginBottom: "14px" },
          children: [
            el("span", { style: { display: "block", fontWeight: "600", marginBottom: "6px" }, text: "姓名" }),
            nameInput,
          ],
        }),
        el("label", {
          style: { display: "block", marginBottom: "8px" },
          children: [
            el("span", { style: { display: "block", fontWeight: "600", marginBottom: "6px" }, text: "身分證後 5 碼" }),
            id5Input,
          ],
        }),
        el("p", { style: { color: "#999", fontSize: "12px", marginTop: "6px" }, text: "※ 例：身分證 A123456789，後 5 碼即為 56789" }),
        errorBox,
      ],
    });

    const iconBox = el("div", { style: { textAlign: "center", fontSize: "48px", marginBottom: "12px" } });
    const rtitleBox = el("div", { style: { fontSize: "17px", fontWeight: "700", textAlign: "center", marginBottom: "14px" } });
    const msgBox = el("div", { style: { background: "#F8FAFD", borderRadius: "8px", padding: "14px 16px", fontSize: "13.5px", lineHeight: "1.85", whiteSpace: "pre-wrap" } });
    const infoBox = el("div", { style: { fontSize: "12px", color: "#888", marginTop: "10px", textAlign: "center" } });

    const resultArea = el("div", {
      style: { display: "none" },
      children: [iconBox, rtitleBox, msgBox, infoBox],
    });

    const closeBtn = el("button", {
      style: { flex: "1", padding: "10px", border: "1px solid #ccc", background: "#fff", borderRadius: "6px", fontFamily: "inherit", fontSize: "14px", cursor: "pointer" },
      text: "關閉",
    });
    const submitBtn = el("button", {
      style: { flex: "1", padding: "10px", border: "none", background: "#0057B8", color: "#fff", borderRadius: "6px", fontFamily: "inherit", fontSize: "14px", fontWeight: "700", cursor: "pointer" },
      text: "查詢",
    });

    const card = el("div", {
      style: { background: "#fff", borderRadius: "12px", maxWidth: "500px", width: "100%", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" },
      children: [
        el("div", {
          style: { background: "#0057B8", color: "#fff", padding: "14px 20px", borderRadius: "12px 12px 0 0", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" },
          children: [el("span", { text: "📋" }), titleSpan],
        }),
        el("div", {
          style: { padding: "24px 22px", fontSize: "14px", lineHeight: "1.7", color: "#333" },
          children: [formArea, resultArea],
        }),
        el("div", {
          style: { padding: "14px 20px", borderTop: "1px solid #e5e5e5", background: "#F8FAFD", borderRadius: "0 0 12px 12px", display: "flex", gap: "10px" },
          children: [closeBtn, submitBtn],
        }),
      ],
    });

    const wrapper = el("div", {
      attrs: { id: "lookup-modal" },
      style: { display: "none", position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)", zIndex: "9999", alignItems: "center", justifyContent: "center", padding: "16px", overflowY: "auto" },
      children: [card],
    });

    document.body.appendChild(wrapper);
    modal = wrapper;
    elements = { title: titleSpan, form: formArea, name: nameInput, id5: id5Input, error: errorBox, result: resultArea, icon: iconBox, rtitle: rtitleBox, msg: msgBox, info: infoBox, close: closeBtn, submit: submitBtn };

    // 事件
    closeBtn.addEventListener("click", close);
    submitBtn.addEventListener("click", doLookup);
    [nameInput, id5Input].forEach(elm =>
      elm.addEventListener("keydown", e => { if (e.key === "Enter") doLookup(); })
    );
    wrapper.addEventListener("click", e => { if (e.target === wrapper) close(); });
  }

  function open(prefill) {
    buildModal();
    modal.style.display = "flex";
    // 鎖 body scroll（背景不會跟著動）
    try { document.body.style.overflow = "hidden"; } catch (e) {}
    elements.form.style.display = "block";
    elements.result.style.display = "none";
    elements.error.style.display = "none";
    elements.submit.style.display = "block";
    elements.title.textContent = "查詢報名狀態";
    elements.name.value = (prefill && prefill.name) || "";
    elements.id5.value = (prefill && prefill.id5) || "";
    if (!elements.name.value) elements.name.focus();
    else elements.id5.focus();
  }

  function close() {
    if (modal) modal.style.display = "none";
    // 清掉「已匯出」自動跳轉 timer，避免學員關閉後仍開新視窗
    if (exportTimerId) { clearTimeout(exportTimerId); exportTimerId = null; }
    // 還原 body scroll
    try { document.body.style.overflow = ""; } catch (e) {}
  }

  async function doLookup() {
    const name = elements.name.value.trim();
    const id5 = elements.id5.value.trim();
    elements.error.style.display = "none";
    if (!name) { showError("請輸入姓名"); return; }
    if (!/^\d{5}$/.test(id5)) { showError("請輸入身分證後 5 碼（5 位數字）"); return; }

    elements.submit.disabled = true;
    elements.submit.textContent = "查詢中...";
    try {
      const url = `${window.CONFIG.API_URL}?action=lookup&name=${encodeURIComponent(name)}&id5=${encodeURIComponent(id5)}`;
      const res = await fetch(url, { mode: "cors" });
      const data = await res.json();

      if (!data.ok) {
        showResult(NOT_FOUND);
        return;
      }
      // v34 修：多筆報名時依「組合狀況」顯示綜合訊息
      // 單筆但仍帶 registrations 也走多筆 path（向前防呆）
      let tpl;
      const regs = Array.isArray(data.registrations) ? data.registrations : null;
      if (regs && regs.length > 1) {
        tpl = buildMultiStatusTpl(regs);
      } else if (regs && regs.length === 1) {
        tpl = STATUS_MESSAGES[regs[0].status] || STATUS_MESSAGES[data.status];
      } else {
        tpl = STATUS_MESSAGES[data.status];
      }
      if (!tpl) {
        showResult({ icon: "❓", title: "狀態未知：" + data.status, msg: "請聯繫本中心查詢詳細狀態：\n" + getContactLines() });
        return;
      }
      showResult(tpl, data);

      if (data.status === "已匯出") {
        // ASP.NET LA03.aspx 接受 query string 自動填入：?SeaNAME=...&SeaID=...
        const idLast5 = data.idCard ? String(data.idCard).slice(-5) : "";
        const fullName = data.name || "";
        const params = new URLSearchParams();
        if (fullName) params.set("SeaNAME", fullName);
        if (idLast5) params.set("SeaID", idLast5);
        const targetUrl = "https://stusys-b.isha.org.tw/LA03.aspx" + (params.toString() ? "?" + params.toString() : "");

        // P1 修補：append 而非 replaceChildren，保留 showResult 寫入的 regId / courseLabel
        // P1 修補：取消 setTimeout window.open（會被行動瀏覽器 popup-block 擋下），改用按鈕點擊（user gesture）
        const link = el("a", {
          attrs: { href: targetUrl, target: "_blank", rel: "noopener" },
          style: { display: "inline-block", marginTop: "12px", background: "#0057B8", color: "#fff", padding: "12px 24px", borderRadius: "6px", textDecoration: "none", fontWeight: "600", fontSize: "14.5px" },
          text: "🔗 點此前往本中心系統（自動帶入資料）",
        });
        const note = el("div", {
          style: { marginTop: "8px", color: "#666", fontSize: "11.5px" },
          text: "點擊上方按鈕後，姓名與身分證後 5 碼會自動帶入查詢頁",
        });
        elements.info.append(document.createElement("br"), link, note);
      }
    } catch (e) {
      showError("查詢失敗，請稍後再試（" + e.message + "）");
    } finally {
      elements.submit.disabled = false;
      elements.submit.textContent = "查詢";
    }
  }

  function showError(msg) {
    elements.error.textContent = msg;
    elements.error.style.display = "block";
  }

  // v34: 多筆報名 → 依組合狀況產生綜合訊息
  function buildMultiStatusTpl(regs) {
    const counts = {};
    regs.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    const total = regs.length;
    const positive = (counts["已匯出"] || 0) + (counts["通過"] || 0);
    const pending = (counts["待審"] || 0) + (counts["補件"] || 0);
    const negative = (counts["拒絕"] || 0) + (counts["取消"] || 0);
    const unknown = total - positive - pending - negative;   // P2 修：未知狀態不漏算

    // 全部正面結果（已匯出 / 通過）
    if (positive === total) {
      return {
        icon: "🎉",
        title: `恭喜！您 ${total} 門課程全部通過審查`,
        msg: "詳細資訊請參考下方各課程編號。如有問題請聯繫本中心：\n" + getContactLines(),
      };
    }
    // 全部審查中
    if (pending === total) {
      return {
        icon: "⏳",
        title: `我們收到您 ${total} 筆報名！`,
        msg: "您的資料正在審查中，承辦人員會仔細確認您的證明文件。\n請耐心等候 🙏",
      };
    }
    // 全部負面（拒絕 / 取消）
    if (negative === total) {
      const rejectN = counts["拒絕"] || 0;
      const cancelN = counts["取消"] || 0;
      let title;
      if (rejectN > 0 && cancelN > 0) title = `您 ${total} 筆報名：${rejectN} 筆未通過、${cancelN} 筆已取消`;
      else if (rejectN > 0) title = `您 ${total} 筆報名均未通過`;
      else title = `您 ${total} 筆報名均已取消`;
      return {
        icon: "💌",
        title,
        msg: "如有疑問請洽本中心：\n" + getContactLines(),
      };
    }
    // 混合狀態 → 各狀態筆數摘要（含未知狀態）
    const parts = [];
    if (positive) parts.push(`${positive} 筆已通過/匯出`);
    if (pending) parts.push(`${pending} 筆審查中`);
    if (negative) parts.push(`${negative} 筆未通過/已取消`);
    if (unknown) parts.push(`${unknown} 筆其他狀態`);   // P2 修
    return {
      icon: "📋",
      title: `您共有 ${total} 筆報名`,
      msg: `狀態：${parts.join("、")}\n各筆詳情請見下方列表。如有問題請洽：\n${getContactLines()}`,
    };
  }

  function showResult(tpl, data) {
    elements.form.style.display = "none";
    elements.result.style.display = "block";
    elements.submit.style.display = "none";
    elements.title.textContent = "查詢結果";
    elements.icon.textContent = tpl.icon;
    elements.rtitle.textContent = tpl.title;
    elements.msg.textContent = tpl.msg;
    elements.info.replaceChildren();
    if (!data) return;

    // v34 修：支援多筆報名（同一身分證可報多堂課）
    const regs = Array.isArray(data.registrations) ? data.registrations : null;
    if (regs && regs.length > 1) {
      // 多筆 → 顯示列表
      const header = el("div", {
        style: { fontWeight: "700", color: "#0057B8", marginBottom: "10px", fontSize: "14px" },
        text: `您共報名 ${regs.length} 門課程：`,
      });
      const list = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
      regs.forEach((r, idx) => {
        const statusText = r.status || "未知狀態";   // Nit 修
        const statusIcon = STATUS_MESSAGES[r.status]?.icon || "📋";
        const statusColor = (r.status === "通過" || r.status === "已匯出") ? "#1e8e3e"
                          : (r.status === "拒絕" || r.status === "取消") ? "#c5221f"
                          : (r.status === "補件") ? "#e8710a"
                          : "#5f6368";
        const card = el("div", {
          style: { border: "1px solid #DDE4EE", borderRadius: "6px", padding: "10px 12px", background: "#fff", textAlign: "left" },
          children: [
            el("div", {
              style: { fontSize: "12px", color: "#666", marginBottom: "4px" },
              text: `${idx + 1}. ${r.courseLabel || "（課程名稱缺漏）"}`,
            }),
            el("div", {
              style: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" },
              children: [
                el("span", { style: { color: "#888" }, text: `編號 ${r.regId || "（編號缺漏）"}` }),
                el("span", {
                  style: { color: statusColor, fontWeight: "700" },
                  text: `${statusIcon} ${statusText}`,
                }),
              ],
            }),
          ],
        });
        list.append(card);
      });
      elements.info.append(header, list);
    } else {
      // 單筆 → 維持原 UI（regs[0] 優先 fallback 到頂層欄位）
      const r0 = (regs && regs[0]) || {};
      const regId = r0.regId || data.regId || "（編號缺漏）";
      const courseLabel = r0.courseLabel || data.courseLabel || "（課程缺漏）";
      elements.info.textContent = `報名編號：${regId}　|　${courseLabel}`;
    }
  }

  window.LookupModal = { open, close };
})();
