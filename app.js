// Firebase Configuration
// ⚠️ IMPORTANT: Replace these values with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyCmwzP7goBPsUjrNVeH2XHI4Qc1_bHro6g",
    authDomain: "chusen-e9f73.firebaseapp.com",
    projectId: "chusen-e9f73",
    storageBucket: "chusen-e9f73.firebasestorage.app",
    messagingSenderId: "725240697238",
    appId: "1:725240697238:web:439ab74b54d3670c0c4db7",
    measurementId: "G-2Y5TB6E9L5"
};

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    setDoc,
    getDoc,
    serverTimestamp,
    orderBy,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin email list (replace with your admin emails)
const ADMIN_EMAILS = ['largeintro@gmail.com'];

// Global state
let currentUser = null;
let currentCampaign = null;

// ===========================
// Utility Functions
// ===========================

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function isAdmin(email) {
    return ADMIN_EMAILS.includes(email);
}

// ===========================
// Authentication
// ===========================

// Google Sign In
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    showLoading();
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;

        // Update UI
        document.getElementById('userPhoto').src = currentUser.photoURL;
        document.getElementById('userName').textContent = currentUser.displayName;
        document.getElementById('userInfo').style.display = 'flex';

        showToast('ログインしました', 'success');
        await loadCampaigns();

        // Show admin button if user is admin
        if (isAdmin(currentUser.email)) {
            document.getElementById('createCampaignBtn').style.display = 'block';
        }

        showScreen('campaignScreen');
    } catch (error) {
        console.error('Login error:', error);
        showToast('ログインに失敗しました: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        currentUser = null;
        document.getElementById('userInfo').style.display = 'none';
        showScreen('loginScreen');
        showToast('ログアウトしました', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('ログアウトに失敗しました', 'error');
    }
});

// Phone number verification removed - now handled in entry form


// ===========================
// Campaign Management
// ===========================

let isLoadingCampaigns = false;

async function loadCampaigns() {
    if (isLoadingCampaigns) return;
    isLoadingCampaigns = true;

    showLoading();
    try {
        const campaignsRef = collection(db, 'campaigns');
        const q = query(campaignsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const campaignList = document.getElementById('campaignList');
        const adminCampaignList = document.getElementById('adminCampaignList');

        // Clear lists
        campaignList.innerHTML = '';
        adminCampaignList.innerHTML = '';

        if (snapshot.empty) {
            campaignList.innerHTML = '<p style="text-align: center; color: #666;">現在、実施中の企画はありません</p>';
            isLoadingCampaigns = false;
            return;
        }

        const userFrag = document.createDocumentFragment();
        const adminFrag = document.createDocumentFragment();

        for (const docSnap of snapshot.docs) {
            const campaign = docSnap.data();
            campaign.id = docSnap.id;

            // Use pre-stored entry count for security and speed
            const entryCount = campaign.entryCount || 0;

            // Check current user's entry status
            let userEntryStatus = null;
            if (currentUser) {
                const entriesRef = collection(db, 'campaigns', campaign.id, 'entries');
                const userEntryQuery = query(entriesRef, where('userId', '==', currentUser.uid));
                const userEntrySnapshot = await getDocs(userEntryQuery);
                if (!userEntrySnapshot.empty) {
                    const entryData = userEntrySnapshot.docs[0].data();
                    if (campaign.drawn) {
                        userEntryStatus = entryData.isWinner ? 'winner' : 'lost';
                    } else {
                        userEntryStatus = 'entered';
                    }
                }
            }

            // User view
            const campaignDiv = createCampaignElement(campaign, entryCount, false, userEntryStatus);
            userFrag.appendChild(campaignDiv);

            // Admin view
            if (currentUser && isAdmin(currentUser.email)) {
                const adminCampaignDiv = createCampaignElement(campaign, entryCount, true);
                adminFrag.appendChild(adminCampaignDiv);
            }
        }

        campaignList.appendChild(userFrag);
        adminCampaignList.appendChild(adminFrag);

    } catch (error) {
        console.error('Load campaigns error:', error);
        showToast('企画の読み込みに失敗しました', 'error');
    } finally {
        showLoading(false);
        isLoadingCampaigns = false;
    }
}

function createCampaignElement(campaign, entryCount, isAdminView, userEntryStatus) {
    const div = document.createElement('div');
    div.className = 'campaign-item';

    const statusText = campaign.drawn ? '抽選済み' : '募集中';
    const statusColor = campaign.drawn ? '#999' : '#06FFA5';

    let actionButtonHtml = '';
    if (isAdminView) {
        actionButtonHtml = `
            <div class="campaign-actions">
                <button class="btn btn-primary btn-draw" data-campaign-id="${campaign.id}" ${campaign.drawn ? 'disabled' : ''}>
                    ${campaign.drawn ? '抽選済み' : '抽選を実行'}
                </button>
                ${campaign.drawn ? `
                    <button class="btn btn-secondary btn-view-entries" data-campaign-id="${campaign.id}">
                        結果・応募者
                    </button>
                ` : ''}
            </div>
        `;
    } else {
        let btnText = campaign.drawn ? '募集終了' : '応募する';
        let btnDisabled = campaign.drawn ? 'disabled' : '';
        let btnClass = 'btn-primary';

        if (userEntryStatus === 'winner') {
            btnText = '当選しました！連絡をお待ちください！';
            btnDisabled = 'disabled';
            btnClass = 'btn-secondary'; // 別の色に
        } else if (userEntryStatus === 'lost') {
            btnText = '残念ながら落選しました';
            btnDisabled = 'disabled';
            btnClass = 'btn-logout'; // 控えめな色に
        } else if (userEntryStatus === 'entered') {
            btnText = '応募済み';
            btnDisabled = 'disabled';
        }

        actionButtonHtml = `
            <div class="campaign-actions">
                <button class="btn ${btnClass} btn-enter" data-campaign-id="${campaign.id}" ${btnDisabled}>
                    ${btnText}
                </button>
            </div>
        `;
    }

    div.innerHTML = `
        <h3>${campaign.name}</h3>
        <p>${campaign.description || ''}</p>
        <div class="campaign-stats">
            <span>👑 作成者: ${campaign.createdByName || '管理者'}</span>
            <span>📊 応募数: ${entryCount}名</span>
            <span>🎯 当選者数: ${campaign.winnerCount || 1}名</span>
            <span style="color: ${statusColor}">● ${statusText}</span>
        </div>
        ${actionButtonHtml}
    `;

    // Event listeners
    if (isAdminView) {
        const drawBtn = div.querySelector('.btn-draw');
        const viewBtn = div.querySelector('.btn-view-entries');

        if (drawBtn) {
            drawBtn.addEventListener('click', () => drawWinners(campaign));
        }
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewEntries(campaign));
        }
    } else {
        const enterBtn = div.querySelector('.btn-enter');
        if (enterBtn) {
            enterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (campaign.drawn) {
                    showToast('この企画は終了しています', 'info');
                } else if (userEntryStatus === 'entered') {
                    showToast('既に応募済みです', 'info');
                } else {
                    startEntry(campaign);
                }
            });
        }
    }

    return div;
}

async function startEntry(campaign) {
    currentCampaign = campaign;

    // Reset form
    document.getElementById('entryForm').reset();

    // Pre-fill email
    document.getElementById('email').value = currentUser.email || '';
    document.getElementById('campaignTitle').textContent = `🎯 ${campaign.name} 🎯`;
    document.getElementById('campaignDescription').textContent = campaign.description || '';

    showScreen('entryScreen');
}

// ===========================
// Postal Code Auto-Lookup
// ===========================

// Initialize Postal Code Lookup (once at start)
function initPostalCodeLookup() {
    const postalCodeInput = document.getElementById('postalCode');
    const addressInput = document.getElementById('address');
    const loadingIndicator = document.getElementById('postalCodeLoading');

    if (!postalCodeInput) return;

    postalCodeInput.addEventListener('input', async (e) => {
        const postalCode = e.target.value.replace(/[^0-9]/g, '');

        if (postalCode.length === 7) {
            loadingIndicator.style.display = 'inline';
            try {
                const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
                const data = await response.json();

                if (data.status === 200 && data.results) {
                    const result = data.results[0];
                    addressInput.value = `${result.address1}${result.address2}${result.address3}`;
                    showToast('住所を自動入力しました', 'success');
                }
            } catch (error) {
                console.error('Postal code lookup error:', error);
            } finally {
                loadingIndicator.style.display = 'none';
            }
        }
    });
}

// Entry Form Submission
document.getElementById('entryForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentCampaign) {
        showToast('企画が選択されていません', 'error');
        return;
    }

    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    // Normalize phone number (remove hyphens, spaces, etc.)
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    const formData = {
        userId: currentUser.uid,
        email: document.getElementById('email').value.trim(),
        fullName: document.getElementById('fullName').value.trim(),
        phoneNumber: normalizedPhone, // Store normalized number
        postalCode: document.getElementById('postalCode').value.trim(),
        address: document.getElementById('address').value.trim(),
        building: document.getElementById('building').value.trim(),
        createdAt: serverTimestamp(),
        isWinner: false
    };

    showLoading();
    try {
        const entryDocRef = doc(db, 'campaigns', currentCampaign.id, 'entries', currentUser.uid);

        // 1. Check if this UID already has an entry (fast & direct)
        const existingEntryDoc = await getDoc(entryDocRef);
        if (existingEntryDoc.exists()) {
            showToast('このアカウントで既に応募済みです', 'error');
            showLoading(false);
            return;
        }

        const entriesRef = collection(db, 'campaigns', currentCampaign.id, 'entries');

        // 2. Check phone number duplicate (normalized)
        const phoneQuery = query(entriesRef, where('phoneNumber', '==', formData.phoneNumber));
        const phoneSnapshot = await getDocs(phoneQuery);

        if (!phoneSnapshot.empty) {
            showToast('この電話番号で既に応募済みです', 'error');
            showLoading(false);
            return;
        }

        // 3. Check address duplicate
        const addressQuery = query(
            entriesRef,
            where('postalCode', '==', formData.postalCode),
            where('address', '==', formData.address)
        );
        const addressSnapshot = await getDocs(addressQuery);

        if (!addressSnapshot.empty) {
            showToast('この住所で既に応募済みです。1世帯につき1回のみ応募可能です。', 'error');
            showLoading(false);
            return;
        }

        // Add entry using UID as Document ID to guarantee uniqueness per campaign
        await setDoc(entryDocRef, formData);

        // Increment entry count on campaign document securely
        const campaignRef = doc(db, 'campaigns', currentCampaign.id);
        await updateDoc(campaignRef, {
            entryCount: increment(1)
        });

        showToast('応募が完了しました！', 'success');
        document.getElementById('entryForm').reset();
        showScreen('successScreen');
    } catch (error) {
        console.error('Entry submission error:', error);
        showToast('応募に失敗しました: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
});

// Back buttons
document.getElementById('backToCampaigns').addEventListener('click', () => {
    showScreen('campaignScreen');
});

document.getElementById('backToCampaignsFromSuccess').addEventListener('click', () => {
    showScreen('campaignScreen');
});

// ===========================
// Admin Functions
// ===========================

// Show create campaign form
document.getElementById('showCreateCampaignForm').addEventListener('click', () => {
    document.getElementById('createCampaignForm').style.display = 'block';
});

document.getElementById('cancelCreateCampaign').addEventListener('click', () => {
    document.getElementById('createCampaignForm').style.display = 'none';
    document.getElementById('newCampaignName').value = '';
    document.getElementById('newCampaignDesc').value = '';
    document.getElementById('winnerCount').value = '1';
});

// Create campaign
document.getElementById('createCampaignSubmit').addEventListener('click', async () => {
    const name = document.getElementById('newCampaignName').value.trim();
    const description = document.getElementById('newCampaignDesc').value.trim();
    const winnerCount = parseInt(document.getElementById('winnerCount').value);

    if (!name) {
        showToast('企画名を入力してください', 'error');
        return;
    }

    showLoading();
    try {
        const campaignsRef = collection(db, 'campaigns');
        await addDoc(campaignsRef, {
            name,
            description,
            winnerCount,
            entryCount: 0, // Initialize count
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || '不明なユーザー',
            createdAt: serverTimestamp(),
            drawn: false
        });

        showToast('企画を作成しました', 'success');
        document.getElementById('createCampaignForm').style.display = 'none';
        document.getElementById('newCampaignName').value = '';
        document.getElementById('newCampaignDesc').value = '';
        document.getElementById('winnerCount').value = '1';

        await loadCampaigns();
    } catch (error) {
        console.error('Create campaign error:', error);
        showToast('企画の作成に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
});

// Draw winners
async function drawWinners(campaign) {
    if (!confirm(`「${campaign.name}」の抽選を実行しますか？\nこの操作は取り消せません。`)) {
        return;
    }

    showLoading();
    try {
        const entriesRef = collection(db, 'campaigns', campaign.id, 'entries');
        const snapshot = await getDocs(entriesRef);

        if (snapshot.empty) {
            showToast('応募者がいません', 'error');
            showLoading(false);
            return;
        }

        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const winnerCount = Math.min(campaign.winnerCount || 1, entries.length);

        // Shuffle and select winners
        const shuffled = entries.sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, winnerCount);

        // Update winners
        for (const winner of winners) {
            const entryRef = doc(db, 'campaigns', campaign.id, 'entries', winner.id);
            await updateDoc(entryRef, { isWinner: true });
        }

        // Mark campaign as drawn
        const campaignRef = doc(db, 'campaigns', campaign.id);
        await updateDoc(campaignRef, { drawn: true, drawnAt: serverTimestamp() });

        showToast(`抽選が完了しました！当選者: ${winnerCount}名`, 'success');
        await loadCampaigns();
    } catch (error) {
        console.error('Draw winners error:', error);
        showToast('抽選に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// View entries
// View entries and results (Admin only)
async function viewEntries(campaign) {
    showLoading();
    try {
        const entriesRef = collection(db, 'campaigns', campaign.id, 'entries');
        // インデックスエラー回避のため、クエリでは並べ替えず、全件取得後にJSでソートする
        const snapshot = await getDocs(entriesRef);

        if (snapshot.empty) {
            alert('応募者がまだいません');
            showLoading(false);
            return;
        }

        // データをJSの配列として取得
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applicantsCount = entries.length;

        // 当選者のみを抽出して名前順にソート
        const winners = entries.filter(e => e.isWinner)
            .sort((a, b) => a.fullName.localeCompare(b.fullName));

        let resultMessage = `【${campaign.name}】当選者リスト\n`;
        resultMessage += `------------------------------------\n\n`;

        let entriesInfo = "";

        if (winners.length === 0) {
            entriesInfo = "（当選者はまだいません。抽選を実行してください）\n";
        } else {
            winners.forEach((entry) => {
                entriesInfo += `🎊 【当選】 ${entry.fullName}\n`;
                entriesInfo += `   📧: ${entry.email}\n`;
                entriesInfo += `   📞: ${entry.phoneNumber}\n`;
                entriesInfo += `   🏠: 〒${entry.postalCode} ${entry.address} ${entry.building || ''}\n`;
                entriesInfo += `------------------------------------\n`;
            });
        }

        const finalHeader = `総応募数: ${applicantsCount}名 / 当選者: ${winners.length}名\n\n`;
        alert(finalHeader + resultMessage + entriesInfo);

    } catch (error) {
        console.error('View entries error:', error);
        showToast('データの取得に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// Admin mode toggle
document.getElementById('createCampaignBtn').addEventListener('click', () => {
    showScreen('adminScreen');
    loadCampaigns();
});

document.getElementById('backToUserMode').addEventListener('click', () => {
    showScreen('campaignScreen');
});

// ===========================
// Initial App Setup
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initPostalCodeLookup();
});

// ===========================
// Auth State Observer
// ===========================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('userPhoto').src = user.photoURL;
        document.getElementById('userName').textContent = user.displayName;
        document.getElementById('userInfo').style.display = 'flex';

        // Show admin button if user is admin
        if (isAdmin(currentUser.email)) {
            document.getElementById('createCampaignBtn').style.display = 'block';
        }

        // Load campaigns and show campaign screen
        await loadCampaigns();
        showScreen('campaignScreen');
    } else {
        currentUser = null;
        document.getElementById('userInfo').style.display = 'none';
        showScreen('loginScreen');
    }
});
