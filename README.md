# 抽選システム - セットアップガイド

原宿系デザインの応募者抽選システムです。Googleアカウント認証、電話番号認証、重複チェック機能を備えています。

## 🎀 機能

- ✨ **Googleアカウント認証** - 簡単ログイン
- 📱 **電話番号による重複チェック** - 同じ電話番号での重複応募を防止
- 🏠 **住所による重複チェック** - 同じ住所での重複応募を防止（1世帯1回）
- 🎪 **複数企画対応** - 異なる抽選企画には参加可能
- 🎯 **自動抽選機能** - 管理者による公平な抽選実行
- 📱 **レスポンシブデザイン** - スマホ・タブレット・PCに対応
- 🌈 **原宿系カラー** - ポップでカラフルなUI

## 📋 必要なもの

1. Googleアカウント
2. Firebaseプロジェクト（無料プランでOK）
3. GitHubアカウント（GitHub Pagesでの公開用）

## 🚀 セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `lottery-system`）
4. Google アナリティクスは任意（不要なら無効化）
5. プロジェクトを作成

### 2. Firebase Authenticationの設定

1. Firebase Console で「Authentication」を選択
2. 「始める」をクリック
3. **Googleプロバイダを有効化**
   - 「Sign-in method」タブ
   - 「Google」を選択して有効化
   - プロジェクトのサポートメールを設定
   - 保存

### 3. Cloud Firestoreの設定

1. Firebase Console で「Firestore Database」を選択
2. 「データベースの作成」をクリック
3. **本番環境モード**を選択（セキュリティルールは後で設定）
4. ロケーションを選択（例: `asia-northeast1` - 東京）
5. 「有効にする」をクリック
6. **セキュリティルールを設定**
   - 「ルール」タブを選択
   - `firestore.rules` ファイルの内容をコピー＆ペースト
   - **重要**: `admin@example.com` を実際の管理者メールアドレスに変更
   - 「公開」をクリック

### 4. Webアプリの追加

1. Firebase Console のプロジェクト概要ページ
2. 「ウェブ」アイコン（`</>`）をクリック
3. アプリのニックネームを入力（例: `Lottery Web App`）
4. 「Firebase Hosting」はチェック不要（GitHub Pagesを使用）
5. 「アプリを登録」をクリック
6. **Firebase設定をコピー**
   ```javascript
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
7. この設定を `app.js` ファイルの先頭部分に貼り付け

### 5. 認証ドメインの追加

GitHub Pagesで公開する場合、認証ドメインを追加する必要があります。

1. Firebase Console の「Authentication」→「Settings」→「Authorized domains」
2. 「ドメインを追加」をクリック
3. `<username>.github.io` を追加（例: `yourname.github.io`）
4. 保存

### 6. 管理者メールアドレスの設定

1. `app.js` ファイルを開く
2. 以下の行を見つけて、管理者のメールアドレスに変更
   ```javascript
   const ADMIN_EMAILS = ['admin@example.com'];
   ```
   複数の管理者を設定する場合:
   ```javascript
   const ADMIN_EMAILS = ['admin1@example.com', 'admin2@example.com'];
   ```

3. `firestore.rules` ファイルも同様に更新
   ```
   function isAdmin() {
     return isAuthenticated() && 
            request.auth.token.email in [
              'admin1@example.com',
              'admin2@example.com'
            ];
   }
   ```

### 7. GitHub Pagesでの公開

1. GitHubで新しいリポジトリを作成（例: `lottery-system`）
2. ローカルでGitリポジトリを初期化
   ```bash
   cd c:/Users/large/Desktop/chusen
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/lottery-system.git
   git push -u origin main
   ```

3. GitHubリポジトリの「Settings」→「Pages」
4. Source: `main` ブランチを選択
5. 「Save」をクリック
6. 数分後、`https://<username>.github.io/lottery-system/` でアクセス可能

## 🎨 カスタマイズ

### カラーテーマの変更

`style.css` の `:root` セクションでカラーパレットを変更できます：

```css
:root {
    --primary-pink: #FF69B4;
    --primary-purple: #9D4EDD;
    --primary-blue: #4CC9F0;
    --primary-yellow: #FFD60A;
    --primary-green: #06FFA5;
}
```

### フォントの変更

`index.html` の `<head>` セクションでGoogle Fontsを変更できます。

## 📱 使い方

### ユーザー側

1. Googleアカウントでログイン
2. 参加したい抽選企画を選択
3. 応募フォームに必要事項を入力（電話番号、住所など）
4. 応募完了！

### 管理者側

1. 管理者メールアドレスでログイン
2. 電話番号認証後、「新しい企画を作成」ボタンが表示される
3. 管理者画面で新しい抽選企画を作成
4. 応募者が集まったら「抽選を実行」ボタンで自動抽選
5. 「応募者を見る」で当選者を確認

## 🔒 セキュリティ

- Firestoreセキュリティルールにより、不正なデータアクセスを防止
- 電話番号と住所の重複チェックにより、1世帯1回の応募を保証
- 管理者のみが抽選を実行可能

## ⚠️ 注意事項

1. **管理者メールアドレス**
   - 必ず実際の管理者メールアドレスに変更してください
   - `app.js` と `firestore.rules` の両方を更新する必要があります

2. **本番環境での使用**
   - テスト後、必ずセキュリティルールを確認してください
   - 定期的にFirebaseのコンソールでアクティビティを監視してください

## 🐛 トラブルシューティング

### ログインできない
- Firebase Consoleで認証ドメインが正しく設定されているか確認
- ブラウザのコンソールでエラーメッセージを確認

### 応募できない
- 同じ電話番号または住所で既に応募していないか確認
- ブラウザのコンソールでエラーメッセージを確認

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙋 サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
