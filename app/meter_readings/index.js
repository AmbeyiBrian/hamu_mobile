import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/AuthContext';
import api from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';

export default function MeterReadingsScreen() {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const isDirector = user?.user_class === 'Director';

  // Load meter readings on component mount
  useEffect(() => {
    loadReadings();
  }, []);

  // Function to load meter readings from API
  const loadReadings = async (pageNum = 1, refresh = false) => {
    if (refresh) {
      setRefreshing(true);
      setPage(1);
      pageNum = 1;
    } else if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Prepare filters
      const filters = { page: pageNum };
      
      // If not director, only show readings from user's shop
      if (!isDirector && user?.shop?.id) {
        filters.shop = user.shop.id;
      }
      
      // Get meter readings from API
      const response = await api.getMeterReadings(pageNum, filters);
      
      // Update state with the readings
      if (pageNum === 1 || refresh) {
        setReadings(response.results || []);
      } else {
        setReadings(prev => [...prev, ...(response.results || [])]);
      }
      
      // Check if there are more pages
      setHasMorePages(!!(response.next));
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load meter readings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Handle refresh (pull to refresh)
  const handleRefresh = useCallback(() => {
    loadReadings(1, true);
  }, []);

  // Handle loading more readings when scrolling to bottom
  const handleLoadMore = () => {
    if (!loadingMore && hasMorePages && readings.length >= 10) {
      loadReadings(page + 1);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Render a meter reading item
  const renderReadingItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.readingCard}
      onPress={() => router.push(`/meter_readings/${item.id}`)}
    >
      <View style={styles.readingHeader}>
        <View style={styles.readingType}>
          <Ionicons name="speedometer" size={18} color="#0077B6" />
          <Text style={styles.readingTypeText}>{item.reading_type}</Text>
        </View>
        <Text style={styles.readingDate}>{formatDate(item.reading_date)}</Text>
      </View>

      <View style={styles.readingDetails}>
        <Text style={styles.readingValue}>{item.value} m³</Text>
        <View style={styles.readingMeta}>
          <Text style={styles.readingShop}>{item.shop_details.shopName}</Text>
          <Text style={styles.readingAgent}>{item.agent_name}</Text>
        </View>
      </View>

      {item.meter_photo && (
        <View style={styles.photoIndicator}>
          <Ionicons name="image" size={16} color="#777" />
          <Text style={styles.photoText}>Photo available</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render footer (loading indicator when loading more)
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0077B6" />
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="water-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>No meter readings found</Text>
        <Text style={styles.emptySubtext}>Add your first meter reading to track water consumption</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meter Readings</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/meter_readings/new')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {isDirector && (
        <View style={styles.filterContainer}>
          <Button 
            mode="outlined" 
            icon="filter" 
            onPress={() => {/* Implement filters */}}
            style={styles.filterButton}
            labelStyle={styles.filterButtonText}
          >
            Filter
          </Button>
        </View>
      )}

      <FlatList
        data={readings}
        renderItem={renderReadingItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#0077B6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    borderColor: '#0077B6',
  },
  filterButtonText: {
    color: '#0077B6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },
  readingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  readingType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readingTypeText: {
    marginLeft: 6,
    color: '#0077B6',
    fontWeight: '500',
  },
  readingDate: {
    color: '#777',
    fontSize: 12,
  },
  readingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readingValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  readingMeta: {
    alignItems: 'flex-end',
  },
  readingShop: {
    fontWeight: '500',
  },
  readingAgent: {
    color: '#777',
    fontSize: 12,
  },
  photoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  photoText: {
    fontSize: 12,
    color: '#777',
    marginLeft: 4,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
  },
});