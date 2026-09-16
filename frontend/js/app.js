// ==========================================================================
//  GearGuard — Dashboard Logic (Real Dataset Streaming & Analysis)
// ==========================================================================

let waveformChart = null;
let fftChart = null;
let chCharts = [null, null, null, null];
let simulationMode = 'healthy'; // Default steady state — NO random slideshow!
let selectedDatasetFile = '';
let isPaused = true;
let currentView = 'overview';

// Alert tracking
let alertHistory = [];
let alertCounts = { critical: 0, warning: 0, advisory: 0, healthy: 0 };
let lastLoggedStatus = null;

// Chart.js Material Design Defaults
Chart.defaults.color = '#5f6368';
Chart.defaults.font.family = "'Google Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
Chart.defaults.font.size = 12;

// --------------------------------------------------------------------------
// INIT OVERVIEW CHARTS
// --------------------------------------------------------------------------
function initOverviewCharts() {
    const ctxW = document.getElementById('waveformChart').getContext('2d');
    waveformChart = new Chart(ctxW, {
        type: 'line',
        data: {
            labels: Array.from({ length: 180 }, (_, i) => i),
            datasets: [{
                data: [],
                borderColor: '#34a853',
                borderWidth: 1.8,
                pointRadius: 0,
                tension: 0.25,
                fill: true,
                backgroundColor: 'rgba(52, 168, 83, 0.08)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: {
                y: {
                    min: -6,
                    max: 6,
                    grid: { color: 'rgba(60, 64, 67, 0.08)' },
                    ticks: { color: '#5f6368' }
                },
                x: { display: false }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });

    const ctxF = document.getElementById('fftChart').getContext('2d');
    fftChart = new Chart(ctxF, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: 'rgba(26, 115, 232, 0.75)',
                borderColor: '#1a73e8',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 150 },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(60, 64, 67, 0.08)' },
                    ticks: { color: '#5f6368' }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#5f6368',
                        maxTicksLimit: 12
                    },
                    title: {
                        display: true,
                        text: 'Frequency (Hz)',
                        color: '#80868b',
                        font: { size: 11, weight: '600' }
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --------------------------------------------------------------------------
// INIT CHANNEL MINI-CHARTS (Sensors View)
// --------------------------------------------------------------------------
function initChannelCharts() {
    const channelIds = ['ch1Chart', 'ch2Chart', 'ch3Chart', 'ch4Chart'];
    const colors = ['#1a73e8', '#34a853', '#f9ab00', '#9334e8'];

    channelIds.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (!el) return;
        const ctx = el.getContext('2d');
        chCharts[idx] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({ length: 150 }, (_, i) => i),
                datasets: [{
                    data: [],
                    borderColor: colors[idx],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.2,
                    fill: true,
                    backgroundColor: colors[idx] + '14'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    y: {
                        grid: { color: 'rgba(60, 64, 67, 0.06)' },
                        ticks: { display: false }
                    },
                    x: { display: false }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    });
}

// --------------------------------------------------------------------------
// NAVIGATION VIEW SWITCHING
// --------------------------------------------------------------------------
const viewTitles = {
    overview: 'Live Vibration Telemetry',
    sensors: 'Multi-Channel Accelerometer Telemetry',
    alerts: 'Fault Event Logs & Anomaly Notifications',
    diagnostics: 'Predictive Maintenance & Engineering Diagnostics'
};

function switchView(viewName) {
    currentView = viewName;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
        view.style.display = 'none';
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'flex';
        targetView.classList.add('active');
    }

    const titleEl = document.getElementById('current-view-title');
    if (titleEl && viewTitles[viewName]) {
        titleEl.textContent = viewTitles[viewName];
    }

    setTimeout(() => {
        if (viewName === 'overview') {
            if (waveformChart) waveformChart.resize();
            if (fftChart) fftChart.resize();
        } else if (viewName === 'sensors') {
            chCharts.forEach(c => c && c.resize());
        }
    }, 50);
}

document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-view');
        if (view) switchView(view);
    });
});

// --------------------------------------------------------------------------
// POPULATE DATASET FILES
// --------------------------------------------------------------------------
async function loadAvailableFiles() {
    try {
        const baseUrl = window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:8000';
        const res = await fetch(`${baseUrl}/api/files`);
        if (!res.ok) return;
        const data = await res.json();
        const select = document.getElementById('dataset-file-select');
        if (!select) return;

        select.innerHTML = '<option value="">Auto Continuous Stream</option>';

        const groupH = document.createElement('optgroup');
        groupH.label = '🟢 Healthy Gearbox Data (SpectraQuest)';
        data.healthy_files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = `Healthy — ${f}`;
            groupH.appendChild(opt);
        });
        select.appendChild(groupH);

        const groupB = document.createElement('optgroup');
        groupB.label = '🔴 Broken Tooth Data (SpectraQuest)';
        data.broken_files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = `Broken Tooth — ${f}`;
            groupB.appendChild(opt);
        });
        select.appendChild(groupB);

        select.addEventListener('change', () => {
            selectedDatasetFile = select.value;
            if (selectedDatasetFile.startsWith('b')) {
                simulationMode = 'broken';
                highlightSimBtn('sim-broken');
            } else if (selectedDatasetFile.startsWith('h')) {
                simulationMode = 'healthy';
                highlightSimBtn('sim-healthy');
            }
            fetchData();
        });
    } catch (e) {
        console.warn('Could not load dataset files list:', e);
    }
}

// --------------------------------------------------------------------------
// FETCH DATA FROM API
// --------------------------------------------------------------------------
async function fetchData() {
    if (isPaused) return; // Freeze stream if user paused to inspect

    try {
        const baseUrl = window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:8000';
        let url = `${baseUrl}/api/dashboard?sim_status=${simulationMode}`;
        if (selectedDatasetFile) {
            url += `&file_name=${encodeURIComponent(selectedDatasetFile)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (data.error) return;
        updateUI(data);
    } catch (err) {
        document.getElementById('last-updated').textContent =
            '⚠️ Cannot reach backend server at http://127.0.0.1:8000 (Ensure server is running)';
    }
}

// --------------------------------------------------------------------------
// UPDATE UI
// --------------------------------------------------------------------------
function updateUI(data) {
    const hero      = document.getElementById('status-hero');
    const statusEl  = document.getElementById('overall-status');
    const subEl     = document.getElementById('status-subtitle');
    const btnReport = document.getElementById('btn-report');
    const mechEl    = document.getElementById('mechanic-report');
    const diyEl     = document.getElementById('diy-tutorial');
    const diyTab    = document.getElementById('diy-tab-btn');
    const ringArc   = document.getElementById('ring-arc');
    const ringScore = document.getElementById('health-score-ring');

    const activeFileStr = data.active_file ? ` [${data.active_file}]` : '';
    document.getElementById('last-updated').textContent =
        `Live Stream Active${activeFileStr} • Synchronized at ` + new Date().toLocaleTimeString();

    hero.className = 'status-hero';

    let colour = '#5f6368';
    let heroClass = '';
    let score = data.health_score ?? 50;
    let severityTag = 'healthy';
    let alertMsg = '';
    let alertAction = '';

    if (data.status.includes('Healthy')) {
        highlightSimBtn('sim-healthy');
        heroClass = 'is-healthy';
        colour = '#34a853';
        severityTag = 'healthy';
        statusEl.textContent = 'Healthy — Optimal Operating Condition';
        subEl.textContent = `Continuous baseline stream from ${data.active_file || 'Healthy Data'}. Vibration levels nominal.`;
        btnReport.style.display = 'inline-flex';
        btnReport.textContent = 'View Scheduled Maintenance Suggestions →';
        diyTab.style.display = 'none';
        score = data.health_score ?? 98;

        mechEl.innerHTML = buildHealthyReport();
        diyEl.innerHTML = '';

        setChartColour('#34a853', 'rgba(52, 168, 83, 0.09)', 'rgba(52, 168, 83, 0.75)', '#34a853');

        alertMsg = 'Normal machine telemetry confirmed across 4 channels.';
        alertAction = 'Nominal baseline verified. Continue standard run.';

    } else if (data.status.includes('Wear')) {
        highlightSimBtn('sim-wear');
        heroClass = 'is-warn';
        colour = '#f9ab00';
        severityTag = 'advisory';
        statusEl.textContent = 'Early Bearing Wear Detected';
        subEl.textContent = 'Elevated high-frequency acoustic energy observed. Minor micro-pitting or raceway degradation.';
        btnReport.style.display = 'inline-flex';
        btnReport.textContent = 'View Diagnostic Report & Fix Guide →';
        diyTab.style.display = 'inline-flex';
        score = data.health_score ?? 64;

        mechEl.innerHTML = buildMechanicReport('Bearing Race Micro-Wear', 'Elevated wideband high-frequency harmonics (3–5 kHz).', [
            'Monitor operating temperatures at bearing housing using an infrared pyrometer.',
            'Perform lubricant oil analysis to detect early microscopic metal particulate.',
            'Schedule bearing re-greasing or replacement during next planned maintenance window.'
        ]);
        diyEl.innerHTML = buildDIYGuide('Step-by-Step Bearing Inspection & Servicing', [
            { title: 'Lockout / Tagout (LOTO)', body: 'Ensure power disconnect switches are locked out and test for zero residual energy.' },
            { title: 'Clean Housing Exterior', body: 'Thoroughly wipe down bearing caps to prevent dust/grit from entering during opening.' },
            { title: 'Unbolt & Inspect Cover', body: 'Remove cover bolts with a torque wrench. Inspect grease colour and check for metallic sheen.' },
            { title: 'Pack High-Temp Synthetic Grease', body: 'Flush old contaminated grease, clean races with solvent, and pack manufacturer-grade NLGI 2 lubricant.' },
            { title: 'Re-torque & Verify', body: 'Torque bolts in cross-pattern to recommended spec (28 Nm) and confirm smooth manual rotation.' }
        ]);

        setChartColour('#f9ab00', 'rgba(249, 171, 0, 0.09)', 'rgba(249, 171, 0, 0.75)', '#f9ab00');

        alertMsg = 'Elevated high-frequency acoustic energy in 3–5 kHz band.';
        alertAction = 'Check bearing temperature and lubricant viscosity.';

    } else if (data.status.includes('Misalignment')) {
        highlightSimBtn('sim-misaligned');
        heroClass = 'is-orange';
        colour = '#fa7b17';
        severityTag = 'warning';
        statusEl.textContent = 'Gear & Shaft Misalignment Detected';
        subEl.textContent = 'Harmonic peaks at 1X and 2X rotational speed indicate severe parallel or angular coupling misalignment.';
        btnReport.style.display = 'inline-flex';
        btnReport.textContent = 'View Alignment Report & Guide →';
        diyTab.style.display = 'inline-flex';
        score = data.health_score ?? 40;

        mechEl.innerHTML = buildMechanicReport('Shaft / Coupling Misalignment', 'High amplitude 2X running speed harmonic peaks.', [
            'Perform dial-indicator or laser shaft alignment between motor and gearbox.',
            'Inspect flexible coupling inserts for wear, cracking, or severe degradation.',
            'Check for soft foot condition and shim mounting pads to eliminate base stress.'
        ]);
        diyEl.innerHTML = buildDIYGuide('Precision Laser Shaft Re-alignment', [
            { title: 'De-energize Equipment', body: 'Disconnect motor drive power and verify that the gearbox is fully stationary.' },
            { title: 'Inspect Soft Foot Condition', body: 'Loosen one bolt at a time with feeler gauge. If gap exceeds 0.05 mm, install pre-cut stainless shims.' },
            { title: 'Mount Laser Alignment Heads', body: 'Clamp transmitter and reflector to drive and driven shafts across the coupling.' },
            { title: 'Sweep Measurement', body: 'Rotate shafts smoothly through 60° sweep to calculate angular and offset error values.' },
            { title: 'Adjust Jackscrews & Torque', body: 'Adjust horizontal positioning screws until angular and parallel misalignment are under 0.05 mm.' }
        ]);

        setChartColour('#fa7b17', 'rgba(250, 123, 23, 0.09)', 'rgba(250, 123, 23, 0.75)', '#fa7b17');

        alertMsg = 'Harmonic peaks at 2X shaft rotational speed detected.';
        alertAction = 'Schedule laser alignment check across motor-gearbox coupling.';

    } else {
        // Broken Gear Tooth
        highlightSimBtn('sim-broken');
        heroClass = 'is-danger';
        colour = '#ea4335';
        severityTag = 'critical';
        statusEl.textContent = 'Critical Fault: Broken Gear Tooth';
        subEl.textContent = `Severe impact shocks at Gear Mesh Frequency from ${data.active_file || 'BrokenTooth Data'}.`;
        btnReport.style.display = 'inline-flex';
        btnReport.textContent = 'View Emergency Repair & Part Guide →';
        diyTab.style.display = 'inline-flex';
        score = data.health_score ?? 21;

        mechEl.innerHTML = buildMechanicReport('Gear Tooth Fracture (Critical)', 'Repetitive impact spikes at GMF with severe sidebands.', [
            'Halt equipment operation immediately to prevent total catastrophic gearcase destruction.',
            'Drain lubricant into a clean container to capture broken tooth fragments and metal chips.',
            'Order replacement pinion and wheel gear pair; single gear replacement is not recommended.'
        ]);
        diyEl.innerHTML = buildDIYGuide('Emergency Gear Teardown & Replacement', [
            { title: 'Emergency Lockout', body: 'Tag and lockout main electrical disconnect; confirm mechanical isolation.' },
            { title: 'Drain and Filter Lubricant', body: 'Drain oil completely through a 100-micron mesh to quantify debris and tooth fragments.' },
            { title: 'Split Casing & Extract Shaft', body: 'Remove casing perimeter bolts, use lift eye-bolts to separate top split case cleanly.' },
            { title: 'Press Out Damaged Gear', body: 'Use hydraulic puller to safely remove fractured gear from keyslot without scoring shaft.' },
            { title: 'Heat-Fit New Gear & Backlash Test', body: 'Induction-heat replacement gear to 110°C, slide onto shaft key, and measure backlash with lead wire (0.15–0.25 mm).' },
            { title: 'Reseal & Commission', body: 'Apply anaerobic flange sealant, re-torque split casing, refill with ISO VG 220 gear oil, and run 30-min break-in.' }
        ]);

        setChartColour('#ea4335', 'rgba(234, 67, 53, 0.09)', 'rgba(234, 67, 53, 0.75)', '#ea4335');

        alertMsg = 'Critical impulse shock pulses at Gear Mesh Frequency (GMF).';
        alertAction = 'Immediate shutdown required. Inspect primary drive gear teeth.';
    }

    hero.classList.add(heroClass);

    // Update Health Arc Gauge
    const circumference = 314;
    const offset = circumference - (score / 100) * circumference;
    ringArc.style.strokeDashoffset = offset;
    ringArc.style.stroke = colour;
    ringScore.textContent = score;
    ringScore.style.color = colour;

    // Update Overview KPIs
    if (data.features?.sensor_1) {
        document.getElementById('m-rms').textContent = data.features.sensor_1.rms.toFixed(3);
        document.getElementById('m-peak').textContent = data.features.sensor_1.peak.toFixed(3);
        document.getElementById('m-kurt').textContent = data.features.sensor_1.kurtosis.toFixed(2);
    }

    // Update Overview Charts smoothly
    if (waveformChart && data.waveforms?.sensor1) {
        waveformChart.data.datasets[0].data = data.waveforms.sensor1;
        waveformChart.update();
    }
    if (fftChart && data.fft) {
        fftChart.data.labels = data.fft.x.map(x => Math.round(x));
        fftChart.data.datasets[0].data = data.fft.y;
        fftChart.update();
    }

    // Update Sensors View
    updateSensorsView(data);

    // Update Alerts Logger
    logAlertEvent(severityTag, data.status, alertMsg, alertAction);
}

// --------------------------------------------------------------------------
// UPDATE SENSORS VIEW
// --------------------------------------------------------------------------
function updateSensorsView(data) {
    if (!data.features) return;

    for (let i = 1; i <= 4; i++) {
        const feat = data.features[`sensor_${i}`];
        if (feat) {
            const rmsEl = document.getElementById(`ch${i}-rms`);
            const peakEl = document.getElementById(`ch${i}-peak`);
            const kurtEl = document.getElementById(`ch${i}-kurt`);
            const meanEl = document.getElementById(`ch${i}-mean`);
            if (rmsEl) rmsEl.textContent = feat.rms.toFixed(3) + ' g';
            if (peakEl) peakEl.textContent = feat.peak.toFixed(3) + ' g';
            if (kurtEl) kurtEl.textContent = feat.kurtosis.toFixed(2);
            if (meanEl) meanEl.textContent = feat.mean.toFixed(3) + ' g';
        }

        const wave = data.waveforms?.[`sensor${i}`];
        if (wave && chCharts[i - 1]) {
            chCharts[i - 1].data.datasets[0].data = wave.slice(0, 150);
            chCharts[i - 1].update();
        }
    }
}

// --------------------------------------------------------------------------
// ALERT EVENT LOGGER
// --------------------------------------------------------------------------
function logAlertEvent(severity, title, msg, action) {
    if (lastLoggedStatus === title) return; // Only log state changes — no spam!
    lastLoggedStatus = title;

    if (severity === 'critical') alertCounts.critical++;
    else if (severity === 'warning') alertCounts.warning++;
    else if (severity === 'advisory') alertCounts.advisory++;
    else alertCounts.healthy++;

    document.getElementById('count-critical').textContent = alertCounts.critical;
    document.getElementById('count-warning').textContent = alertCounts.warning;
    document.getElementById('count-advisory').textContent = alertCounts.advisory;
    document.getElementById('count-healthy').textContent = alertCounts.healthy;

    const unackCount = alertCounts.critical + alertCounts.warning + alertCounts.advisory;
    const sidebarBadge = document.getElementById('alert-badge');
    if (sidebarBadge) {
        sidebarBadge.textContent = unackCount;
        sidebarBadge.style.display = unackCount > 0 ? 'inline-block' : 'none';
    }

    const container = document.getElementById('alert-list-container');
    const emptyMsg = document.getElementById('empty-alert-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';

    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'alert-entry';
    entry.innerHTML = `
        <div class="alert-entry-left">
            <span class="alert-severity-tag tag-${severity}">${severity}</span>
            <div class="alert-entry-msg">
                <strong>${title} — ${msg}</strong>
                <span>Action: ${action}</span>
            </div>
        </div>
        <span class="alert-entry-time">${timestamp}</span>
    `;

    container.insertBefore(entry, container.firstChild);
    while (container.children.length > 40) {
        container.removeChild(container.lastChild);
    }
}

// Clear Alerts Button
const clearAlertsBtn = document.getElementById('btn-clear-alerts');
if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', () => {
        alertCounts = { critical: 0, warning: 0, advisory: 0, healthy: 0 };
        document.getElementById('count-critical').textContent = '0';
        document.getElementById('count-warning').textContent = '0';
        document.getElementById('count-advisory').textContent = '0';
        document.getElementById('count-healthy').textContent = '0';

        const sidebarBadge = document.getElementById('alert-badge');
        if (sidebarBadge) {
            sidebarBadge.textContent = '0';
            sidebarBadge.style.display = 'none';
        }

        const container = document.getElementById('alert-list-container');
        container.innerHTML = `
            <div class="empty-alerts" id="empty-alert-msg">
                <span class="empty-icon">✅</span>
                <strong>Alerts Acknowledged & Cleared</strong>
                <p>Telemetry audit trail reset. Monitoring continues in real-time.</p>
            </div>
        `;
    });
}

// --------------------------------------------------------------------------
// START / PAUSE TELEMETRY STREAM CONTROLS
// --------------------------------------------------------------------------
function resetToZeroState() {
    isPaused = true;
    const hero = document.getElementById('status-hero');
    const statusEl = document.getElementById('overall-status');
    const subEl = document.getElementById('status-subtitle');
    const ringScore = document.getElementById('health-score-ring');
    const ringArc = document.getElementById('ring-arc');
    const btnReport = document.getElementById('btn-report');
    const btnToggle = document.getElementById('btn-stream-toggle');
    const statusPill = document.getElementById('stream-status-pill');

    if (hero) hero.className = 'status-hero is-standby';
    if (statusEl) statusEl.textContent = 'Telemetry Standby — Stream Inactive';
    if (subEl) subEl.textContent = 'Sensors are offline in standby mode. Press ▶ Start Telemetry Stream to initiate live vibration acquisition.';
    if (ringScore) ringScore.textContent = '0';
    if (ringArc) ringArc.setAttribute('stroke-dashoffset', '314');
    if (btnReport) btnReport.style.display = 'none';

    // Zero KPI metric cards
    const mRms = document.getElementById('m-rms');
    const mPeak = document.getElementById('m-peak');
    const mKurt = document.getElementById('m-kurtosis');
    const mSensors = document.getElementById('m-sensors');

    if (mRms) mRms.textContent = '0.000';
    if (mPeak) mPeak.textContent = '0.000';
    if (mKurt) mKurt.textContent = '0.00';
    if (mSensors) mSensors.textContent = '0 / 4';

    // Zero channel cards
    for (let i = 1; i <= 4; i++) {
        const valEl = document.getElementById(`ch${i}-val`);
        if (valEl) valEl.textContent = '0.000 g';
    }

    // Flatline waveform & FFT charts
    const zeros = new Array(180).fill(0);
    const fftZerosX = Array.from({length: 60}, (_, i) => i * 30);
    const fftZerosY = new Array(60).fill(0);

    if (waveformChart) {
        waveformChart.data.labels = zeros.map((_, i) => i);
        waveformChart.data.datasets[0].data = zeros;
        waveformChart.update('none');
    }
    if (fftChart) {
        fftChart.data.labels = fftZerosX;
        fftChart.data.datasets[0].data = fftZerosY;
        fftChart.update('none');
    }

    // Update toggle button UI
    if (btnToggle) {
        btnToggle.innerHTML = '<span class="btn-icon">▶</span> <span id="stream-btn-text">Start Telemetry Stream</span>';
        btnToggle.className = 'google-btn stream-toggle-btn btn-start';
    }
    if (statusPill) {
        statusPill.className = 'stream-status-chip paused';
        statusPill.innerHTML = '<span class="pulse-dot"></span> Standby (Paused)';
    }

    const lastUpd = document.getElementById('last-updated');
    if (lastUpd) lastUpd.textContent = '⏸ Telemetry Standby • Press Start to stream real-time data';
}

function startStream() {
    isPaused = false;
    const btnToggle = document.getElementById('btn-stream-toggle');
    const statusPill = document.getElementById('stream-status-pill');

    if (btnToggle) {
        btnToggle.innerHTML = '<span class="btn-icon">⏸</span> <span id="stream-btn-text">Pause Telemetry Stream</span>';
        btnToggle.className = 'google-btn stream-toggle-btn btn-pause';
    }
    if (statusPill) {
        statusPill.className = 'stream-status-chip streaming';
        statusPill.innerHTML = '<span class="pulse-dot"></span> Live Telemetry (200 Hz)';
    }
    fetchData();
}

const streamToggleBtn = document.getElementById('btn-stream-toggle');
if (streamToggleBtn) {
    streamToggleBtn.addEventListener('click', () => {
        if (isPaused) {
            startStream();
        } else {
            resetToZeroState();
        }
    });
}

// --------------------------------------------------------------------------
// CUSTOM FILE UPLOAD HANDLER
// --------------------------------------------------------------------------
const fileInput = document.getElementById('file-upload-input');
const btnTestFile = document.getElementById('btn-test-file');
if (btnTestFile && fileInput) {
    btnTestFile.addEventListener('click', () => {
        fileInput.value = ''; // reset selection
        fileInput.click();
    });
}
if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('last-updated').textContent = `⏳ Analyzing uploaded file: ${file.name}...`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const baseUrl = window.location.origin.startsWith('http') ? '' : 'http://127.0.0.1:8000';
            const res = await fetch(`${baseUrl}/api/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.error) {
                alert('Upload Error: ' + data.error);
                return;
            }

            // Pause live timer so user can review the uploaded file analysis
            isPaused = true;
            if (pauseBtn) {
                pauseBtn.textContent = '▶️ Resume Stream';
                pauseBtn.style.background = '#fef7e0';
                pauseBtn.style.color = '#b06000';
            }

            updateUI(data);
            // Switch to overview view to show analysis
            switchView('overview');
            // Auto open the diagnostics report
            modal.classList.add('open');
        } catch (err) {
            alert('Failed to upload and analyze file: ' + err.message);
        }
    });
}

// --------------------------------------------------------------------------
// HELPERS — Chart Colour Update
// --------------------------------------------------------------------------
function setChartColour(waveLine, waveFill, fftBg, fftBorder) {
    if (waveformChart) {
        waveformChart.data.datasets[0].borderColor = waveLine;
        waveformChart.data.datasets[0].backgroundColor = waveFill;
    }
    if (fftChart) {
        fftChart.data.datasets[0].backgroundColor = fftBg;
        fftChart.data.datasets[0].borderColor = fftBorder;
    }
}

// --------------------------------------------------------------------------
// HELPERS — Report HTML Builders
// --------------------------------------------------------------------------
function buildHealthyReport() {
    return `
        <h3>Telemetry Status: Optimal Condition ✅</h3>
        <p>Real-time FFT and time-domain signals confirm nominal baseline operation. No structural damage, misalignment, or bearing defect frequencies detected.</p>
        
        <h3>Preventive Maintenance Recommendations</h3>
        <ul>
            <li>Maintain recommended lubrication schedule (re-lube every 500 operating hours).</li>
            <li>Inspect shaft lip seals visually for signs of thermal degradation or oil leakage.</li>
            <li>Keep motor cooling fan cowling free of airborne dust and debris accumulation.</li>
            <li>Archive this clean baseline telemetry profile for future anomaly comparison.</li>
        </ul>
        <button class="print-btn" onclick="window.print()">🖨️ Print Maintenance Log</button>
    `;
}

function buildMechanicReport(faultType, indicator, actions) {
    const items = actions.map(a => `<li>${a}</li>`).join('');
    return `
        <h3>Engineering Diagnostic Summary</h3>
        <p><strong>Identified Condition:</strong> ${faultType}</p>
        <p><strong>Key Telemetry Indicator:</strong> ${indicator}</p>
        <p><strong>Primary Signal Sensor:</strong> SpectraQuest Channel 1 (Planetary Gearbox Radial)</p>
        
        <h3>Actionable Maintenance Instructions</h3>
        <ul>${items}</ul>
        
        <button class="print-btn" onclick="window.print()">🖨️ Print Diagnostic Work Order</button>
    `;
}

function buildDIYGuide(title, steps) {
    const items = steps.map((s, i) =>
        `<li><strong>Step ${i+1} — ${s.title}:</strong> ${s.body}</li>`
    ).join('');
    return `
        <h3>${title}</h3>
        <div class="warning-box">
            <strong>⚠️ Mandatory Safety Notice:</strong> Follow OSHA / ISO Lockout/Tagout (LOTO) protocols before opening any enclosure or handling mechanical drives.
        </div>
        <ol class="tutorial-steps">${items}</ol>
        <button class="print-btn" onclick="window.print()">🖨️ Print Step-by-Step SOP</button>
    `;
}

// --------------------------------------------------------------------------
// MODAL CONTROLS
// --------------------------------------------------------------------------
const modal = document.getElementById('report-modal');
const btnReport = document.getElementById('btn-report');
const btnOpenFromDiag = document.getElementById('btn-open-modal-from-diag');
const closeBtn = document.getElementById('modal-close-btn');
const overlay = document.querySelector('.modal-overlay');

if (btnReport) btnReport.addEventListener('click', () => modal.classList.add('open'));
if (btnOpenFromDiag) btnOpenFromDiag.addEventListener('click', () => modal.classList.add('open'));
if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));
if (overlay) overlay.addEventListener('click', () => modal.classList.remove('open'));

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
        modal.classList.remove('open');
    }
});

function openTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(t => {
        t.classList.remove('active');
        t.style.display = 'none';
    });
    document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
    const el = document.getElementById(tabId);
    el.style.display = 'block';
    el.classList.add('active');
    if (btn) btn.classList.add('active');
}

// --------------------------------------------------------------------------
// SIMULATION CONTROLS
// --------------------------------------------------------------------------
function highlightSimBtn(activeId) {
    ['sim-healthy', 'sim-wear', 'sim-misaligned', 'sim-broken'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.blur();
        btn.style.boxShadow = '';
        btn.style.fontWeight = '';
        if (id === activeId) {
            btn.classList.add('active');
            btn.style.opacity = '1';
            btn.style.filter = 'none';
        } else {
            btn.classList.remove('active');
            btn.style.opacity = '0.45';
            btn.style.filter = 'blur(0.3px)';
        }
    });
}

document.getElementById('sim-healthy').addEventListener('click', () => {
    simulationMode = 'healthy';
    selectedDatasetFile = '';
    document.getElementById('dataset-file-select').value = '';
    highlightSimBtn('sim-healthy');
    if (isPaused) startStream(); else fetchData();
});
document.getElementById('sim-wear').addEventListener('click', () => {
    simulationMode = 'wear';
    selectedDatasetFile = '';
    document.getElementById('dataset-file-select').value = '';
    highlightSimBtn('sim-wear');
    if (isPaused) startStream(); else fetchData();
});
document.getElementById('sim-misaligned').addEventListener('click', () => {
    simulationMode = 'misalignment';
    selectedDatasetFile = '';
    document.getElementById('dataset-file-select').value = '';
    highlightSimBtn('sim-misaligned');
    if (isPaused) startStream(); else fetchData();
});
document.getElementById('sim-broken').addEventListener('click', () => {
    simulationMode = 'broken';
    selectedDatasetFile = '';
    document.getElementById('dataset-file-select').value = '';
    highlightSimBtn('sim-broken');
    if (isPaused) startStream(); else fetchData();
});

// --------------------------------------------------------------------------
// INITIALIZATION
// --------------------------------------------------------------------------
initOverviewCharts();
initChannelCharts();
loadAvailableFiles();
highlightSimBtn('sim-healthy');
resetToZeroState(); // Start in 0 / Standby mode until user hits Start
setInterval(fetchData, 1500);
