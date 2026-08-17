document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobInfoAllInOne
      });
      
      if (results && results[0] && results[0].result) {
        const info = results[0].result;
        if (info.company) document.getElementById('company').value = info.company;
        if (info.position) document.getElementById('position').value = info.position;
        if (info.salary) document.getElementById('salary').value = info.salary;
        if (info.location) document.getElementById('location').value = info.location;
        if (info.jobDescription) document.getElementById('jobDescription').value = info.jobDescription;
        
        if (tab.url.includes('zhipin.com')) document.getElementById('channel').value = 'BOSS直聘';
        else if (tab.url.includes('zhaopin.com')) document.getElementById('channel').value = '智联招聘';
        else if (tab.url.includes('51job.com')) document.getElementById('channel').value = '前程无忧';
        else if (tab.url.includes('lagou.com')) document.getElementById('channel').value = '拉勾网';
        else if (tab.url.includes('liepin.com')) document.getElementById('channel').value = '猎聘';
        else if (tab.url.includes('nowcoder.com')) document.getElementById('channel').value = '牛客网';
        else document.getElementById('channel').value = '官网';
      }
    }
  } catch(e) {
    console.log('自动抓取失败:', e);
  }
  
  saveBtn.addEventListener('click', async () => {
    const company = document.getElementById('company').value.trim();
    const position = document.getElementById('position').value.trim();
    
    if (!company || !position) {
      showStatus('请填写公司名称和岗位名称', 'error');
      return;
    }
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const data = {
      company,
      position,
      salary: document.getElementById('salary').value.trim(),
      location: document.getElementById('location').value.trim(),
      channel: document.getElementById('channel').value,
      batch: document.getElementById('batch').value,
      jobDescription: document.getElementById('jobDescription').value.trim(),
      applyUrl: tab ? tab.url : '',
      status: '已投递',
      date: new Date().toISOString().slice(0, 10)
    };
    
    saveBtn.disabled = true;
    showStatus('正在保存...', 'loading');
    
    try {
      const response = await fetch('http://localhost:19876/add-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        showStatus('✅ 保存成功！', 'success');
        setTimeout(() => window.close(), 1500);
      } else {
        showStatus('保存失败：' + (result.message || '未知错误'), 'error');
        saveBtn.disabled = false;
      }
    } catch(e) {
      showStatus('连接失败，请确认桌面软件已打开', 'error');
      saveBtn.disabled = false;
    }
  });
});

function showStatus(msg, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

// 通用智能抓取 - 简单可靠
function extractJobInfoAllInOne() {
  const info = { company: '', position: '', salary: '', location: '', jobDescription: '' };
  const url = window.location.href;
  const title = document.title;
  const bodyText = document.body ? document.body.innerText : '';
  
  // ===== 1. 公司名称 =====
  const domainMap = {
    'kuaishou': '快手', 'bytedance': '字节跳动', 'toutiao': '字节跳动',
    'tencent': '腾讯', 'alibaba': '阿里巴巴', 'alipay': '蚂蚁集团',
    'baidu': '百度', 'meituan': '美团', 'jd.com': '京东', 'jd.hk': '京东',
    'xiaomi': '小米', 'huawei': '华为', 'netease': '网易', 'didichuxing': '滴滴',
    'pinduoduo': '拼多多', 'bilibili': '哔哩哔哩', 'mihoyo': '米哈游',
    'sina': '新浪', 'sohu': '搜狐', 'weibo': '微博', 'zhihu': '知乎',
    'ximalaya': '喜马拉雅', 'vanke': '万科', 'haier': '海尔', 'midea': '美的',
    'byd': '比亚迪', 'nio': '蔚来', 'xiaopeng': '小鹏', 'lixiang': '理想',
    'pwc': '普华永道', 'deloitte': '德勤', 'ey': '安永', 'kpmg': '毕马威',
    'zhipin': 'BOSS直聘', 'zhaopin': '智联招聘', '51job': '前程无忧',
    'liepin': '猎聘', 'nowcoder': '牛客网', 'acmcoder': '赛码网'
  };
  for (const [key, name] of Object.entries(domainMap)) {
    if (url.toLowerCase().includes(key)) { info.company = name; break; }
  }
  
  // ===== 2. 岗位名称（通用：找页面最显眼的大标题）=====
  // 方法1：遍历所有h1/h2/h3，找第一个不像导航/标题词的
  const navWords = ['校招', '社招', '招聘', '首页', '登录', '注册', '官网', '职位', '岗位', '公告', '动态', '人才', '项目'];
  const headings = document.querySelectorAll('h1, h2, h3');
  for (const h of headings) {
    const text = (h.innerText || '').trim();
    if (text && text.length > 1 && text.length < 60) {
      const isNav = navWords.some(w => text === w || (text.includes(w) && text.length < 8));
      const isJdKeyword = /(职位描述|岗位职责|任职要求|岗位要求|工作内容|职位要求|工作要求|加分项|优先条件)/.test(text);
      if (!isNav && !isJdKeyword) {
        // 检查位置：排除页面最顶部的导航区域
        const rect = h.getBoundingClientRect();
        if (rect.top > 30 || text.length > 4) {
          info.position = text;
          break;
        }
      }
    }
  }
  
  // 方法2：从页面标题提取（取第一部分，排除导航词）
  if (!info.position) {
    const parts = title.split(/[-|_—–·]/).map(p => p.trim()).filter(p => p);
    for (const part of parts) {
      if (part.length > 1 && part.length < 60 && !navWords.some(w => part === w || (part.includes(w) && part.length < 8))) {
        info.position = part;
        break;
      }
    }
  }
  
  // ===== 3. 工作地点 =====
  const cities = ['北京','上海','广州','深圳','杭州','成都','武汉','西安','南京','重庆',
    '苏州','天津','长沙','郑州','青岛','大连','宁波','厦门','合肥','福州','济南',
    '昆明','哈尔滨','沈阳','长春','石家庄','太原','南昌','贵阳','南宁','兰州',
    '珠海','佛山','东莞','无锡','常州','嘉兴','绍兴','金华','泉州','烟台'];
  const locMatch = bodyText.match(/(?:工作地点|工作城市|地点|城市|base)[：:\s]*([\u4e00-\u9fa5、]{2,15})/);
  if (locMatch) info.location = locMatch[1].trim();
  if (!info.location) {
    for (const city of cities) {
      if (bodyText.includes(city)) { info.location = city; break; }
    }
  }
  
  // ===== 4. 薪资 =====
  const salMatch = bodyText.match(/(\d{1,3}[Kk万])\s*[-~至到]\s*(\d{1,3}[Kk万])(?:\s*[·*]\s*\d{1,2}薪)?/);
  if (salMatch) info.salary = salMatch[0];
  
  // ===== 5. 岗位描述（精确抓取：从职位描述开始取同级内容）=====
  const jdStartKeywords = ['职位描述', '岗位职责', '工作内容', '岗位描述', '职责描述', '职位职责'];
  const jdContinueKeywords = ['任职要求', '岗位要求', '任职资格', '职位要求', '工作要求', '岗位说明', '加分项', '优先条件', '额外要求', '职位要求'];
  const stopKeywords = ['相关职位', '推荐职位', '相似岗位', '相关岗位', '热门职位', '公司介绍', '关于我们', '企业介绍', '公司简介', '投递简历', '立即投递', '申请职位', '分享到', '扫码', '职位列表', '投递', '简历投递', '应聘'];
  
  for (const keyword of jdStartKeywords) {
    const allElements = document.querySelectorAll('h1, h2, h3, h4, strong, b, div, span');
    for (const el of allElements) {
      if (el.innerText && el.innerText.trim() === keyword) {
        let content = keyword + '\n';
        
        // 只取当前元素后面的同级兄弟元素
        let sibling = el.nextElementSibling;
        while (sibling && content.length < 4000) {
          // 跳过按钮元素
          if (sibling.tagName === 'BUTTON' || sibling.querySelector('button')) {
            sibling = sibling.nextElementSibling;
            continue;
          }
          const siblingText = (sibling.innerText || '').trim();
          
          // 遇到停止词就停止
          if (stopKeywords.some(k => siblingText.includes(k) && siblingText.length < 30)) break;
          
          // 如果是大标题，检查是否是需要继续的关键词
          const tag = sibling.tagName;
          if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'STRONG' || tag === 'B') {
            const isContinue = jdContinueKeywords.some(k => siblingText.includes(k));
            if (!isContinue && siblingText.length < 30) break;
          }
          
          if (siblingText && siblingText.length > 0) {
            content += siblingText + '\n';
          }
          sibling = sibling.nextElementSibling;
        }
        
        // 如果同级内容不够，尝试取父元素的下一个兄弟（但要检查是否是相关职位区域）
        if (content.length < 100 && el.parentElement) {
          let parentSibling = el.parentElement.nextElementSibling;
          while (parentSibling && content.length < 4000) {
            const psText = (parentSibling.innerText || '').trim();
            if (stopKeywords.some(k => psText.includes(k))) break;
            if (psText && psText.length > 10) {
              content += '\n' + psText;
            }
            parentSibling = parentSibling.nextElementSibling;
          }
        }
        
        if (content && content.length > 30) {
          info.jobDescription = content.slice(0, 4000);
          break;
        }
      }
    }
    if (info.jobDescription) break;
  }
  
  // 兜底：找文字最多的区块
  if (!info.jobDescription) {
    const allDivs = document.querySelectorAll('div, section, article');
    let bestBlock = '';
    let bestScore = 0;
    for (const div of allDivs) {
      const text = div.innerText || '';
      if (text.length > 100 && text.length < 5000) {
        let score = text.length;
        for (const kw of ['职责', '要求', '负责', '任职', '岗位', '职位', '加分']) {
          if (text.includes(kw)) score += 100;
        }
        if (score > bestScore) {
          bestScore = score;
          bestBlock = text;
        }
      }
    }
    if (bestBlock && bestBlock.length > 50) info.jobDescription = bestBlock.slice(0, 4000);
  }
  
  return info;
}
