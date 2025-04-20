import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../services/AuthContext';
import api from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { Button } from 'react-native-paper';

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const isDirector = user?.user_class === 'Director';

  // Load expenses on component mount
  useEffect(() => {
    loadExpenses();
  }, []);

  // Function to load expenses from API
  const loadExpenses = async (pageNum = 1, refresh = false) => {
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
      
      // If not director, only show expenses from user's shop
      if (!isDirector && user?.shop?.id) {
        filters.shop = user.shop.id;
      }
      
      // Get expenses from API
      const response = await api.getExpenses(pageNum, filters);
      
      // Update state with the expenses
      if (pageNum === 1 || refresh) {
        setExpenses(response.results || []);
      } else {
        setExpenses(prev => [...prev, ...(response.results || [])]);
      }
      
      // Check if there are more pages
      setHasMorePages(!!(response.next));
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Handle refresh (pull to refresh)
  const handleRefresh = useCallback(() => {
    loadExpenses(1, true);
  }, []);

  // Handle loading more expenses when scrolling to bottom
  const handleLoadMore = () => {
    if (!loadingMore && hasMorePages && expenses.length >= 10) {
      loadExpenses(page + 1);
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

  // Format currency
  const formatCurrency = (amount) => {
    return `KSh ${parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Render an expense item
  const renderExpenseItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.expenseCard}
      onPress={() => router.push(`/expenses/${item.id}`)}
    >
      <View style={styles.expenseHeader}>
        <View style={styles.expenseDescription}>
          <Ionicons name="cash-outline" size={18} color="#e67e22" />
          <Text style={styles.expenseText} numberOfLines={1}>{item.description}</Text>
        </View>
        <Text style={styles.expenseDate}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.expenseDetails}>
        <Text style={styles.expenseAmount}>{formatCurrency(item.cost)}</Text>
        <View style={styles.expenseMeta}>
          <Text style={styles.expenseShop}>{item.shop_details.shopName}</Text>
          <Text style={styles.expenseAgent}>{item.agent_name}</Text>
        </View>
      </View>

      {item.receipt && (
        <View style={styles.receiptIndicator}>
          <Ionicons name="receipt" size={16} color="#777" />
          <Text style={styles.receiptText}>Receipt available</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render footer (loading indicator when loading more)
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#e67e22" />
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cash-outline" size={80} color="#ccc" />
        <Text style={styles.emptyText}>No expenses found</Text>
        <Text style={styles.emptySubtext}>Add your first expense to track your spending</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/expenses/new')}
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
        data={expenses}
        renderItem={renderExpenseItem}
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
    backgroundColor: '#e67e22',
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
    borderColor: '#e67e22',
  },
  filterButtonText: {
    color: '#e67e22',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },
  expenseCard: {
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
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expenseDescription: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseText: {
    marginLeft: 6,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  expenseDate: {
    color: '#777',
    fontSize: 12,
  },
  expenseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e67e22',
  },
  expenseMeta: {
    alignItems: 'flex-end',
  },
  expenseShop: {
    fontWeight: '500',
  },
  expenseAgent: {
    color: '#777',
    fontSize: 12,
  },
  receiptIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  receiptText: {
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