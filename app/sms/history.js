import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../Colors';
import api from '../../services/api';

export default function SMSHistoryScreen() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const router = useRouter();

  // Load SMS history
  useEffect(() => {
    loadMessages();
  }, []);

  // Load messages from the API
  const loadMessages = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
        setPage(1);
      } else if (isLoading === false && !refresh) {
        // Loading more items
        setPage(prevPage => prevPage + 1);
      } else {
        setIsLoading(true);
      }

      const pageToLoad = refresh ? 1 : page;
      const response = await api.getSMSHistory(pageToLoad);
      
      const newMessages = response.results || [];
      
      if (refresh || pageToLoad === 1) {
        setMessages(newMessages);
      } else {
        setMessages(prevMessages => [...prevMessages, ...newMessages]);
      }
      
      setHasMore((response.next !== null));
      
    } catch (error) {
      console.error('Failed to load SMS history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadMessages(true);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if date is today
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if date is yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show full date
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Render item
  const renderItem = ({ item }) => (
    <View style={styles.messageItem}>
      <View style={styles.messageHeader}>
        <Text style={styles.phoneNumber}>{item.target_phone}</Text>
        <Text style={styles.messageDate}>{formatDate(item.sent_at)}</Text>
      </View>
      
      <Text style={styles.messageContent} numberOfLines={3}>
        {item.message_body}
      </Text>
      
      {item.sender_id && (
        <Text style={styles.senderId}>Sender: {item.sender_id}</Text>
      )}
    </View>
  );

  // Render list footer
  const renderFooter = () => {
    if (!isLoading || messages.length === 0) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading more messages...</Text>
      </View>
    );
  };

  // Render empty content
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-outline" size={80} color={Colors.lightText} />
      <Text style={styles.emptyText}>No SMS messages found</Text>
      <TouchableOpacity
        style={styles.newButton}
        onPress={() => router.push('/sms/bulk')}
      >
        <Text style={styles.newButtonText}>Send New SMS</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={!isLoading && renderEmpty()}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
          />
        }
        onEndReached={() => {
          if (hasMore && !isLoading && !isRefreshing) {
            loadMessages();
          }
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={
          messages.length === 0 ? styles.listEmptyContent : styles.listContent
        }
      />
      
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => router.push('/sms/bulk')}
      >
        <Ionicons name="send" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  messageItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  messageDate: {
    fontSize: 12,
    color: Colors.lightText,
  },
  messageContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  senderId: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 8,
    fontStyle: 'italic',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.lightText,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: Colors.lightText,
    marginTop: 16,
    marginBottom: 24,
  },
  newButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  newButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  fabButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});