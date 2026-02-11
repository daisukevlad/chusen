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
    deleteDoc,
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
    return email && ADMIN_EMAILS.includes(email);
}

function getCampaignIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showScreen('errorScreen');
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
        document.getElementById('userPhoto').src = currentUser.photoURL || '';
        document.getElementById('userName').textContent = currentUser.displayName || '';
        document.getElementById('userInfo').style.display = 'flex';

        showToast('ログインしました', 'success');

        handleNavigationAfterLogin();
    } catch (error) {
        console.error('Login error:', error);
        showToast('ログインに失敗しました: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
});

// Logout
async function handleLogout() {
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
}

document.getElementById('logoutBtn').addEventListener('click', handleLogout);
if (document.getElementById('backToLogin')) {
    document.getElementById('backToLogin').addEventListener('click', handleLogout);
}
document.getElementById('retryLoginBtn').addEventListener('click', () => {
    showScreen('loginScreen');
});

// ===========================
// Navigation Logic
// ===========================

async function handleNavigationAfterLogin() {
    const campaignId = getCampaignIdFromUrl()?.trim();
    console.log('Detected Campaign ID:', campaignId);

    if (campaignId) {
        // Load specific campaign
        showLoading();
        try {
            const campaignRef = doc(db, 'campaigns', campaignId);
            const campaignSnap = await getDoc(campaignRef);

            if (!campaignSnap.exists()) {
                console.error('Campaign not found in Firestore for ID:', campaignId);
                showError(`指定された抽選企画が見つかりませんでした (ID: ${campaignId})。URLが正しいか確認してください。`);
                return;
            }

            const campaign = campaignSnap.data();
            campaign.id = campaignSnap.id;

            // Check if user has already entered
            const entryDocRef = doc(db, 'campaigns', campaign.id, 'entries', currentUser.uid);
            const entrySnap = await getDoc(entryDocRef);

            let userEntryStatus = null;
            if (entrySnap.exists()) {
                const entryData = entrySnap.data();
                if (campaign.drawn) {
                    userEntryStatus = entryData.isWinner ? 'winner' : 'lost';
                } else {
                    userEntryStatus = 'entered';
                }

                // Show status in entry screen
                startEntry(campaign, userEntryStatus);
            } else if (campaign.drawn) {
                showError('この抽選企画は既に終了しています。');
            } else {
                startEntry(campaign);
            }

        } catch (error) {
            console.error('Error loading campaign:', error);
            showError('企画の読み込み中にエラーが発生しました。');
        } finally {
            showLoading(false);
        }
    } else {
        // No ID in URL - only admins can access the admin screen
        if (isAdmin(currentUser.email)) {
            showScreen('adminScreen');
            loadAdminCampaigns();
        } else {
            showError('企画者の発行した専用URLからアクセスしてください。直接のアクセスは制限されています。');
        }
    }
}

// ===========================
// Campaign Management (Admin Only)
// ===========================

async function loadAdminCampaigns() {
    showLoading();
    try {
        const campaignsRef = collection(db, 'campaigns');
        const q = query(campaignsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const adminCampaignList = document.getElementById('adminCampaignList');
        adminCampaignList.innerHTML = '';

        if (snapshot.empty) {
            adminCampaignList.innerHTML = '<p style="text-align: center; color: #666;">まだ作成した企画はありません</p>';
            return;
        }

        const adminFrag = document.createDocumentFragment();

        for (const docSnap of snapshot.docs) {
            const campaign = docSnap.data();
            campaign.id = docSnap.id;
            const entryCount = campaign.entryCount || 0;

            const adminCampaignDiv = createAdminCampaignElement(campaign, entryCount);
            adminFrag.appendChild(adminCampaignDiv);
        }

        adminCampaignList.appendChild(adminFrag);

    } catch (error) {
        console.error('Load admin campaigns error:', error);
        showToast('データの読み込みに失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

function createAdminCampaignElement(campaign, entryCount) {
    const div = document.createElement('div');
    div.className = 'campaign-item';

    const statusText = campaign.drawn ? '抽選済み' : '募集中';
    const statusColor = campaign.drawn ? '#999' : '#06FFA5';

    // Generate campaign URL (more robustly handling local files and different origins)
    const baseUrl = window.location.href.split('?')[0].split('#')[0];
    const campaignUrl = `${baseUrl}?id=${campaign.id}`;

    div.innerHTML = `
        <h3>${campaign.name}</h3>
        <p>${campaign.description || ''}</p>
        <div class="campaign-stats">
            <span>📊 応募数: ${entryCount}名</span>
            <span>🎯 当選者数: ${campaign.winnerCount || 1}名</span>
            <span style="color: ${statusColor}">● ${statusText}</span>
        </div>
        <div class="url-share-section" style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
            <p style="font-size: 0.8em; margin-bottom: 5px; color: #666;">🔗 配布用URL:</p>
            <div style="display: flex; gap: 5px;">
                <input type="text" class="input" value="${campaignUrl}" readonly style="font-size: 0.8em; padding: 5px;">
                <button class="btn btn-secondary btn-copy" data-url="${campaignUrl}" style="padding: 5px 10px; font-size: 0.8em;">コピー</button>
            </div>
        </div>
        <div class="campaign-actions" style="margin-top: 15px;">
            <button class="btn btn-primary btn-draw" data-campaign-id="${campaign.id}" ${campaign.drawn ? 'disabled' : ''}>
                ${campaign.drawn ? '抽選済み' : '抽選を実行'}
            </button>
            <button class="btn btn-secondary btn-view-entries" data-campaign-id="${campaign.id}">
                結果・応募者
            </button>
        </div>
    `;

    // Copy event
    div.querySelector('.btn-copy').addEventListener('click', (e) => {
        const url = e.target.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
            showToast('URLをコピーしました', 'success');
        });
    });

    // Draw event
    const drawBtn = div.querySelector('.btn-draw');
    if (drawBtn) {
        drawBtn.addEventListener('click', () => drawWinners(campaign));
    }

    // View entries event
    const viewBtn = div.querySelector('.btn-view-entries');
    if (viewBtn) {
        viewBtn.addEventListener('click', () => viewEntries(campaign));
    }

    return div;
}

async function startEntry(campaign, userEntryStatus = null) {
    currentCampaign = campaign;

    // Reset form
    document.getElementById('entryForm').reset();

    // Pre-fill email
    document.getElementById('email').value = currentUser.email || '';
    document.getElementById('campaignTitle').textContent = `🎯 ${campaign.name} 🎯`;
    document.getElementById('campaignDescription').textContent = campaign.description || '';

    // Handle status
    const submitBtn = document.querySelector('#entryForm button[type="submit"]');

    if (userEntryStatus) {
        if (userEntryStatus === 'winner') {
            submitBtn.textContent = '当選しました！おめでとうございます！';
            submitBtn.disabled = true;
            submitBtn.className = 'btn btn-secondary btn-large';
        } else if (userEntryStatus === 'lost') {
            submitBtn.textContent = '残念ながら落選しました';
            submitBtn.disabled = true;
            submitBtn.className = 'btn btn-logout btn-large';
        } else if (userEntryStatus === 'entered') {
            submitBtn.textContent = '既に応募済みです（結果待ち）';
            submitBtn.disabled = true;
            submitBtn.className = 'btn btn-secondary btn-large';
        }
    } else {
        submitBtn.textContent = '応募する 🎉';
        submitBtn.disabled = false;
        submitBtn.className = 'btn btn-primary btn-large';
    }

    showScreen('entryScreen');
}

// ===========================
// Postal Code Auto-Lookup
// ===========================

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
    const normalizedPhone = phoneNumber.replace(/\D/g, '');

    const formData = {
        userId: currentUser.uid,
        email: document.getElementById('email').value.trim(),
        fullName: document.getElementById('fullName').value.trim(),
        phoneNumber: normalizedPhone,
        postalCode: document.getElementById('postalCode').value.trim(),
        address: document.getElementById('address').value.trim(),
        building: document.getElementById('building').value.trim(),
        createdAt: serverTimestamp(),
        isWinner: false
    };

    showLoading();
    try {
        const entryDocRef = doc(db, 'campaigns', currentCampaign.id, 'entries', currentUser.uid);

        const existingEntryDoc = await getDoc(entryDocRef);
        if (existingEntryDoc.exists()) {
            showToast('このアカウントで既に応募済みです', 'error');
            showLoading(false);
            return;
        }

        await setDoc(entryDocRef, formData);

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

// ===========================
// Admin Functions
// ===========================

document.getElementById('showCreateCampaignForm').addEventListener('click', () => {
    document.getElementById('createCampaignForm').style.display = 'block';
});

document.getElementById('cancelCreateCampaign').addEventListener('click', () => {
    document.getElementById('createCampaignForm').style.display = 'none';
    document.getElementById('newCampaignName').value = '';
    document.getElementById('newCampaignDesc').value = '';
    document.getElementById('winnerCount').value = '1';
});

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
            entryCount: 0,
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

        await loadAdminCampaigns();
    } catch (error) {
        console.error('Create campaign error:', error);
        showToast('企画の作成に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
});

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

        const shuffled = entries.sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, winnerCount);
        const winnersSet = new Set(winners.map(w => w.id));

        // Update winners
        for (const winner of winners) {
            const entryRef = doc(db, 'campaigns', campaign.id, 'entries', winner.id);
            await updateDoc(entryRef, { isWinner: true });
        }

        // Delete losers (Personal info removal)
        const losers = entries.filter(e => !winnersSet.has(e.id));
        for (const loser of losers) {
            const entryRef = doc(db, 'campaigns', campaign.id, 'entries', loser.id);
            await deleteDoc(entryRef);
        }

        // Mark campaign as drawn
        const campaignRef = doc(db, 'campaigns', campaign.id);
        await updateDoc(campaignRef, { drawn: true, drawnAt: serverTimestamp() });

        showToast(`抽選が完了しました！当選者: ${winnerCount}名`, 'success');
        await loadAdminCampaigns();
    } catch (error) {
        console.error('Draw winners error:', error);
        showToast('抽選に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

async function viewEntries(campaign) {
    showLoading();
    try {
        const entriesRef = collection(db, 'campaigns', campaign.id, 'entries');
        const snapshot = await getDocs(entriesRef);

        if (snapshot.empty) {
            alert('応募者がまだいません');
            showLoading(false);
            return;
        }

        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const applicantsCount = campaign.entryCount || entries.length;

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
        document.getElementById('userPhoto').src = user.photoURL || '';
        document.getElementById('userName').textContent = user.displayName || '';
        document.getElementById('userInfo').style.display = 'flex';

        handleNavigationAfterLogin();
    } else {
        currentUser = null;
        document.getElementById('userInfo').style.display = 'none';
        showScreen('loginScreen');
    }
});
