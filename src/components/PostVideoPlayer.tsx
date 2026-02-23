import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Text } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useStorageUrl } from '../hooks/useStorageUrl';

interface PostVideoPlayerProps {
  storageId: string;
  style?: any;
}

const PostVideoPlayer: React.FC<PostVideoPlayerProps> = ({ storageId, style }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoUrl = useStorageUrl(storageId);
  const playerRef = useRef<VideoView>(null);

  // Only create player when URL is available
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (player && videoUrl) {
      player.loop = false;
      player.muted = false;
      // Explicitly pause on initialization - no auto-play
      player.pause();
      setIsPlaying(false);
    }
  });

  // Reset state when URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsLoaded(false);
      setIsLoading(true);
      setIsPlaying(false);
      setIsFullscreen(false);
    }
  }, [videoUrl]);

  // Timeout to prevent loading spinner from getting stuck
  useEffect(() => {
    if (isLoading && videoUrl) {
      const timeout = setTimeout(() => {
        setIsLoading(false);
        setIsLoaded(true);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, videoUrl]);

  // Track playing state and video readiness
  useEffect(() => {
    if (!player || !videoUrl) return;

    // Video is ready when player exists
    setIsLoading(false);
    setIsLoaded(true);
    if (player) {
      player.pause();
      setIsPlaying(false);
      
      // Try to get video dimensions to calculate aspect ratio
      // Note: expo-video doesn't directly expose dimensions, so we'll use a flexible approach
      // The video will determine its own aspect ratio through contentFit="contain"
    }

    const interval = setInterval(() => {
      if (player) {
        setIsPlaying(player.playing);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [player, videoUrl]);

  if (!videoUrl) {
    return (
      <View style={[styles.container, style, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6b7280" />
      </View>
    );
  }

  const enterFullscreen = async () => {
    if (!playerRef.current || !player || !isLoaded) return;
    
    try {
      const videoView = playerRef.current as any;
      if (videoView && typeof videoView.enterFullscreen === 'function') {
        await videoView.enterFullscreen();
      }
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  };

  const handleVideoPress = () => {
    // When video is pressed and not in fullscreen, enter fullscreen
    if (!isFullscreen && isLoaded) {
      enterFullscreen();
    }
  };

  const handlePlayPause = () => {
    if (!player || !isFullscreen) return;
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleToggleMute = () => {
    if (!player || !isFullscreen) return;
    player.muted = !player.muted;
  };

  return (
    <View style={[styles.wrapper, style, isFullscreen && styles.wrapperHidden]}>
      <TouchableOpacity 
        style={[
          styles.container, 
          !isFullscreen && styles.containerFlexible,
          isFullscreen && styles.containerFullscreen
        ]} 
        activeOpacity={1}
        onPress={handleVideoPress}
        disabled={isFullscreen || !isLoaded}
      >
        <VideoView
          ref={playerRef}
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={isFullscreen}
          allowsFullscreen={true}
          onFullscreenEnter={() => {
            setIsFullscreen(true);
            // Entered fullscreen - start playing
            if (player) {
              setTimeout(() => {
                if (player) {
                  player.play();
                }
              }, 300);
            }
          }}
          onFullscreenExit={() => {
            setIsFullscreen(false);
            // Exited fullscreen - pause video
            if (player) {
              player.pause();
              setIsPlaying(false);
            }
          }}
        />
      
      
      {/* Loading spinner - only show when loading and not in fullscreen */}
      {isLoading && !isLoaded && !isFullscreen && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}

      {/* Fullscreen hint - only show when NOT in fullscreen */}
      {isLoaded && !isLoading && !isFullscreen && (
        <View style={styles.fullscreenHint}>
          <Ionicons name="expand" size={16} color="#ffffff" />
          <Text style={styles.fullscreenHintText}>Tap to play in fullscreen</Text>
        </View>
      )}

      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  wrapperHidden: {
    // Hide wrapper when in fullscreen to prevent double-sizing
    // Make completely invisible but keep in layout to prevent jumps
    opacity: 0,
    pointerEvents: 'none',
  },
  container: {
    width: '100%',
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  containerFullscreen: {
    // When in fullscreen, hide container completely to prevent it showing in background
    // Make invisible and non-interactive
    opacity: 0,
    pointerEvents: 'none',
    // Keep same dimensions to prevent layout shifts
    backgroundColor: 'transparent',
  },
  containerFlexible: {
    // For non-fullscreen: remove fixed aspect ratio to allow videos to use their natural ratio
    // Optimized for vertical videos: taller container reduces side black bars
    // Video maintains its natural size while container better matches vertical aspect ratios
    height: 350,
    maxHeight: 450,
    minHeight: 200,
    // Center the container
    alignSelf: 'center',
    // The video will fit within this container using contentFit="contain"
    // Taller container (350px vs 200px) means vertical videos use more of the width
    // This reduces the relative size of side black bars while keeping video size similar
  },
  video: {
    width: '100%',
    height: '100%',
    // contentFit="contain" will fit the video to the container
    // For vertical videos: will fit height, width will be smaller (no side black bars)
    // For horizontal videos: will fit width, height will be smaller (no top/bottom black bars)
  },
  videoFullscreen: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  pauseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  fullscreenHintText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  fullscreenControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});

export default PostVideoPlayer;
