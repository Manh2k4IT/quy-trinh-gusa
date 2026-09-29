package vn.gusa.quytrinh.mobile;

import android.Manifest;
import android.app.DownloadManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String DOWNLOAD_CHANNEL_ID = "payment-template-downloads-v1";
    private static final int DOWNLOAD_PERMISSION_REQUEST = 7301;
    private final Handler downloadHandler = new Handler(Looper.getMainLooper());
    private boolean backPressPending;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createDownloadNotificationChannel();
        if (getBridge() == null) return;

        WebView webView = getBridge().getWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (backPressPending) return;
                backPressPending = true;
                webView.evaluateJavascript(
                    "(function(){var shell=document.querySelector('.app-shell');if(!shell||!shell.classList.contains('is-mobile-menu-open'))return false;shell.classList.remove('is-mobile-menu-open');var backdrop=document.querySelector('[data-mobile-menu-backdrop]');if(backdrop)backdrop.hidden=true;var toggle=document.querySelector('[data-mobile-menu-toggle]');if(toggle)toggle.setAttribute('aria-expanded','false');return true;})()",
                    menuClosed -> {
                        backPressPending = false;
                        if ("true".equals(menuClosed)) return;
                        if (webView.canGoBack()) {
                            webView.goBack();
                            return;
                        }
                        setEnabled(false);
                        MainActivity.this.getOnBackPressedDispatcher().onBackPressed();
                    }
                );
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            Uri uri = Uri.parse(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"quytrinh.gusa.vn".equalsIgnoreCase(uri.getHost())) return;

            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, DOWNLOAD_PERMISSION_REQUEST);
            }

            DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (downloadManager == null) {
                Toast.makeText(this, "Không thể khởi tạo tải xuống.", Toast.LENGTH_SHORT).show();
                return;
            }

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri)
                .setTitle(fileName)
                .setDescription("Đang tải file mẫu thanh toán...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            if (mimeType != null) request.setMimeType(mimeType);
            if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            long downloadId = downloadManager.enqueue(request);
            trackDownload(downloadManager, downloadId, fileName);
            Toast.makeText(this, "Đang tải: " + fileName, Toast.LENGTH_SHORT).show();
        });
    }

    private void createDownloadNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            DOWNLOAD_CHANNEL_ID,
            "Tải file mẫu thanh toán",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Tiến trình tải và trạng thái hoàn tất file mẫu thanh toán");
        manager.createNotificationChannel(channel);
    }

    private int getDownloadNotificationId(long downloadId) {
        return 73000 + (int) (downloadId % 10000);
    }

    private void showDownloadNotification(int notificationId, String fileName, int progress, boolean indeterminate, String message, boolean finished, boolean failed) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        int icon = failed ? android.R.drawable.stat_notify_error : finished ? android.R.drawable.stat_sys_download_done : android.R.drawable.stat_sys_download;
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, DOWNLOAD_CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(finished ? "Tải mẫu hoàn tất" : failed ? "Tải mẫu thất bại" : fileName)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(true)
            .setOngoing(!finished && !failed)
            .setAutoCancel(finished || failed)
            .setProgress(indeterminate ? 0 : 100, progress, indeterminate);
        manager.notify(notificationId, notification.build());
    }

    private void trackDownload(DownloadManager downloadManager, long downloadId, String fileName) {
        int notificationId = getDownloadNotificationId(downloadId);
        Runnable[] poll = new Runnable[1];
        poll[0] = () -> {
            try (Cursor cursor = downloadManager.query(new DownloadManager.Query().setFilterById(downloadId))) {
                if (cursor == null || !cursor.moveToFirst()) {
                    showDownloadNotification(notificationId, fileName, 0, false, "Không tìm thấy tiến trình tải.", false, true);
                    return;
                }
                int statusColumn = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                int downloadedColumn = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                int totalColumn = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                int reasonColumn = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                int status = cursor.getInt(statusColumn);
                long downloaded = downloadedColumn >= 0 ? cursor.getLong(downloadedColumn) : 0;
                long total = totalColumn >= 0 ? cursor.getLong(totalColumn) : -1;
                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    showDownloadNotification(notificationId, fileName, 100, false, "Đã lưu trong thư mục Tải xuống.", true, false);
                } else if (status == DownloadManager.STATUS_FAILED) {
                    int reason = reasonColumn >= 0 ? cursor.getInt(reasonColumn) : 0;
                    showDownloadNotification(notificationId, fileName, 0, false, "Không thể tải file (" + reason + ").", false, true);
                } else {
                    int progress = total > 0 ? (int) Math.min(100, downloaded * 100 / total) : 0;
                    String progressText = total > 0 ? progress + "% · " + fileName : "Đang tải " + fileName;
                    showDownloadNotification(notificationId, fileName, progress, total <= 0, progressText, false, false);
                    downloadHandler.postDelayed(poll[0], 600);
                }
            } catch (Exception error) {
                showDownloadNotification(notificationId, fileName, 0, false, "Không thể đọc tiến trình tải.", false, true);
            }
        };
        poll[0].run();
    }
}
