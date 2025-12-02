import { useCallback, useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  GlassPanel,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  StatusBadge,
} from '../components';
import { useServers } from '../hooks/useServers';
import { useManagedCameraStream } from '../hooks/useStreamManager';
import {
  uploadVideoFile,
  listUploadedVideos,
  startUploadedVideo,
  stopUploadedVideo,
  getStatus,
} from '../api/client';
import type { UploadedVideo, PipelineStatus } from '../types';
import styles from './VideoUpload.module.css';
import ServerLayout from './ServerLayout';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString();
}

export function VideoUpload() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { getServer } = useServers();
  const server = getServer(serverId || '');

  const [videos, setVideos] = useState<UploadedVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [startTarget, setStartTarget] = useState<string | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conf, setConf] = useState(server?.cameras?.[0]?.conf ?? 0.25);
  const [weights, setWeights] = useState(server?.cameras?.[0]?.weights ?? 'yolo11n.pt');

  useEffect(() => {
    if (server) {
      setConf(server.cameras?.[0]?.conf ?? 0.25);
      setWeights(server.cameras?.[0]?.weights ?? 'yolo11n.pt');
    }
  }, [server]);

  const refreshStatus = useCallback(async () => {
    if (!server) return;
    try {
      const next = await getStatus(server.baseUrl);
      setStatus(next);
    } catch {
      setStatus(null);
    }
  }, [server]);

  const refreshVideos = useCallback(async () => {
    if (!server) return;
    setVideosLoading(true);
    try {
      const list = await listUploadedVideos(server.baseUrl);
      setVideos(list);
    } catch (err) {
      console.error(err);
      setError('Failed to load uploaded videos.');
    } finally {
      setVideosLoading(false);
    }
  }, [server]);

  useEffect(() => {
    refreshVideos();
  }, [refreshVideos]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const activeVideo = useMemo(() => videos.find((video) => video.active), [videos]);
  const uploadCameraStatus = status?.cameras?.upload ?? null;

  const streamServerId = server?.id || serverId || 'upload';
  const baseUrl = server?.baseUrl || '';
  const token = server?.token || '';

  const {
    videoRef,
    isConnecting,
    isConnected,
    isManuallyStopped,
    error: streamError,
    connect,
    disconnect,
  } = useManagedCameraStream(
    streamServerId,
    'upload',
    baseUrl,
    token,
    `upload-${streamServerId}`,
    Boolean(server)
  );

  const handleStart = useCallback(
    async (videoId: string) => {
      if (!server) return;
      setStartTarget(videoId);
      setError(null);
      try {
        await startUploadedVideo(server.baseUrl, videoId, {
          conf,
          yoloWeights: weights,
        });
        await refreshVideos();
        await refreshStatus();
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : 'Failed to start detection for this video.'
        );
      } finally {
        setStartTarget(null);
      }
    },
    [server, conf, weights, refreshVideos, refreshStatus]
  );

  const handleStop = useCallback(async () => {
    if (!server || !activeVideo) return;
    setStopLoading(true);
    setError(null);
    try {
      await stopUploadedVideo(server.baseUrl, activeVideo.videoId);
      await refreshVideos();
      await refreshStatus();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to stop detection.');
    } finally {
      setStopLoading(false);
    }
  }, [server, activeVideo, refreshVideos, refreshStatus]);

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!server || !selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadVideoFile(server.baseUrl, selectedFile);
      setSelectedFile(null);
      await refreshVideos();
      await handleStart(uploaded.videoId);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload video.');
    } finally {
      setUploading(false);
    }
  };

  if (!server) {
    return (
      <ServerLayout>
        <GlassPanel className={styles.emptyState} glow>
          <h2>Server not found</h2>
          <p>The server you're looking for doesn't exist.</p>
          <PrimaryButton onClick={() => navigate('/servers')}>Back to Servers</PrimaryButton>
        </GlassPanel>
      </ServerLayout>
    );
  }

  return (
    <ServerLayout>
      <div className={styles.container}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.grid}>
          <GlassPanel className={styles.formPanel} glow>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Upload MP4</h2>
                <p>Send a prerecorded video to the server and run the same YOLO pipeline.</p>
              </div>
            </div>

            <form className={styles.uploadForm} onSubmit={handleUpload}>
              <label className={styles.fileInput}>
                <span>Select an MP4 (or MOV/AVI)</span>
                <input
                  type="file"
                  accept="video/mp4,video/x-m4v,video/*"
                  onChange={handleFileChange}
                />
              </label>

              {selectedFile && (
                <div className={styles.selectedFile}>
                  <div>
                    <div className={styles.selectedFileName}>{selectedFile.name}</div>
                    <div className={styles.selectedFileMeta}>{formatBytes(selectedFile.size)}</div>
                  </div>
                  <SecondaryButton
                    size="sm"
                    type="button"
                    onClick={() => setSelectedFile(null)}
                  >
                    Clear
                  </SecondaryButton>
                </div>
              )}

              <div className={styles.formRow}>
                <label htmlFor="conf-input">Confidence Threshold</label>
                <input
                  id="conf-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={conf}
                  onChange={(e) => setConf(Number(e.target.value))}
                />
              </div>

              <div className={styles.formRow}>
                <label htmlFor="weights-input">YOLO Weights Path</label>
                <input
                  id="weights-input"
                  type="text"
                  value={weights}
                  onChange={(e) => setWeights(e.target.value)}
                />
              </div>

              <div className={styles.actions}>
                <PrimaryButton
                  type="submit"
                  loading={uploading}
                  disabled={!selectedFile || uploading}
                >
                  Upload &amp; Detect
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  onClick={refreshVideos}
                  loading={videosLoading}
                >
                  Refresh List
                </SecondaryButton>
              </div>
            </form>
          </GlassPanel>

          <GlassPanel className={styles.streamPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Detection Preview</h2>
                <p>Plays back the uploaded video through the virtual camera.</p>
              </div>
              <StatusBadge
                active={uploadCameraStatus?.running ?? false}
                label={uploadCameraStatus?.running ? 'Detecting' : 'Idle'}
              />
            </div>

            <div className={styles.infoLine}>
              Source:{' '}
              <span>
                {uploadCameraStatus?.source
                  ? uploadCameraStatus.source
                  : 'No uploaded video running'}
              </span>
            </div>

            <div className={styles.videoShell}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.videoElement}
              />
              {!isConnected && (
                <div className={styles.videoPlaceholder}>
                  <p className={styles.placeholderText}>
                    {isConnecting
                      ? 'Connecting to WebRTC stream...'
                      : isManuallyStopped
                      ? 'Stream manually stopped'
                      : 'No stream connected'}
                  </p>
                </div>
              )}
            </div>

            {streamError && <div className={styles.streamError}>{streamError}</div>}

            <div className={styles.streamControls}>
              <SecondaryButton size="sm" onClick={connect} disabled={isConnected || !baseUrl}>
                Connect
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={disconnect} disabled={!isConnected}>
                Disconnect
              </SecondaryButton>
              <DangerButton
                size="sm"
                onClick={handleStop}
                loading={stopLoading}
                disabled={!activeVideo}
              >
                Stop Detection
              </DangerButton>
            </div>
          </GlassPanel>
        </div>

        <GlassPanel className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div>
              <h3>Uploaded Videos</h3>
              <p>Choose one to replay through the detection pipeline.</p>
            </div>
            <PrimaryButton size="sm" onClick={refreshVideos} loading={videosLoading}>
              Refresh
            </PrimaryButton>
          </div>

          {videos.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No uploads yet. Drop an MP4 above to get started.</p>
            </div>
          ) : (
            <div className={styles.videoList}>
              {videos.map((video) => (
                <div
                  key={video.videoId}
                  className={`${styles.videoRow} ${
                    video.active ? styles.videoRowActive : ''
                  }`}
                >
                  <div className={styles.videoMeta}>
                    <span className={styles.videoName}>{video.filename}</span>
                    <span className={styles.videoInfo}>
                      {formatBytes(video.sizeBytes)} · Uploaded {formatDate(video.uploadedAt)}
                    </span>
                    {video.lastStartedAt && (
                      <span className={styles.videoInfo}>
                        Last run: {formatDate(video.lastStartedAt)}
                      </span>
                    )}
                  </div>
                  <div className={styles.videoActions}>
                    <StatusBadge
                      active={video.status === 'processing'}
                      label={video.status === 'processing' ? 'Processing' : video.status}
                    />
                    <PrimaryButton
                      size="sm"
                      onClick={() => handleStart(video.videoId)}
                      loading={startTarget === video.videoId}
                      disabled={startTarget !== null && startTarget !== video.videoId}
                    >
                      {video.active ? 'Restart' : 'Start'}
                    </PrimaryButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </ServerLayout>
  );
}

export default VideoUpload;

