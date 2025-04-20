import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Button } from 'react-native-paper';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

const DateRangePicker = ({ startDate, endDate, onApply, onCancel }) => {
  const [modalVisible, setModalVisible] = useState(true);
  const [selectedStartDate, setSelectedStartDate] = useState(startDate);
  const [selectedEndDate, setSelectedEndDate] = useState(endDate);
  const [currentStep, setCurrentStep] = useState('start'); // 'start' or 'end'

  // Format date for calendar marking
  const formatDate = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Get calendar marked dates
  const getMarkedDates = () => {
    const markedDates = {};
    const start = selectedStartDate ? formatDate(selectedStartDate) : null;
    const end = selectedEndDate ? formatDate(selectedEndDate) : null;
    
    if (start) {
      markedDates[start] = {
        startingDay: true,
        color: '#e67e22',
        textColor: 'white'
      };
    }
    
    if (end) {
      markedDates[end] = {
        endingDay: true,
        color: '#e67e22',
        textColor: 'white'
      };
    }
    
    // Mark dates in between
    if (start && end) {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      
      for (let time = startTime + 86400000; time < endTime; time += 86400000) {
        const dateString = new Date(time).toISOString().split('T')[0];
        markedDates[dateString] = {
          color: '#ffedd5',
          textColor: '#e67e22'
        };
      }
    }
    
    return markedDates;
  };

  // Handle date selection
  const handleDayPress = (day) => {
    const selectedDate = new Date(day.dateString);
    
    if (currentStep === 'start') {
      setSelectedStartDate(selectedDate);
      setSelectedEndDate(null);
      setCurrentStep('end');
    } else {
      // Ensure end date is after start date
      if (selectedDate >= selectedStartDate) {
        setSelectedEndDate(selectedDate);
      } else {
        // If user selects a date before start date, swap them
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(selectedDate);
      }
    }
  };

  // Reset and start over
  const resetSelection = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setCurrentStep('start');
  };

  // Format date for display
  const formatDisplayDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Handle apply button
  const handleApply = () => {
    if (selectedStartDate) {
      onApply(selectedStartDate, selectedEndDate || selectedStartDate);
    }
    setModalVisible(false);
  };

  // Handle cancel button
  const handleCancel = () => {
    setModalVisible(false);
    onCancel();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerText}>
              Select {currentStep === 'start' ? 'Start' : 'End'} Date
            </Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <View style={styles.selectedDatesContainer}>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>
                {selectedStartDate ? formatDisplayDate(selectedStartDate) : 'Select date'}
              </Text>
            </View>
            
            <Ionicons name="arrow-forward" size={20} color="#777" style={styles.dateArrow} />
            
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>End Date</Text>
              <Text style={styles.dateValue}>
                {selectedEndDate ? formatDisplayDate(selectedEndDate) : 'Select date'}
              </Text>
            </View>
          </View>

          <Calendar
            onDayPress={handleDayPress}
            markingType={'period'}
            markedDates={getMarkedDates()}
            theme={{
              todayTextColor: '#e67e22',
              arrowColor: '#e67e22',
              dotColor: '#e67e22',
              textDayFontFamily: 'System',
              textMonthFontFamily: 'System',
              textDayHeaderFontFamily: 'System',
              textDayFontWeight: '400',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '400'
            }}
          />

          <View style={styles.actionsContainer}>
            {(selectedStartDate || selectedEndDate) && (
              <Button 
                mode="text" 
                onPress={resetSelection}
                style={styles.resetButton}
                labelStyle={styles.resetButtonText}
              >
                Reset
              </Button>
            )}
            
            <Button 
              mode="contained" 
              onPress={handleApply}
              style={styles.applyButton}
              labelStyle={styles.applyButtonText}
              disabled={!selectedStartDate}
            >
              Apply
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  selectedDatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f9f9f9',
  },
  dateBox: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  dateArrow: {
    marginHorizontal: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  resetButton: {
    marginRight: 8,
  },
  resetButtonText: {
    color: '#777',
  },
  applyButton: {
    backgroundColor: '#e67e22',
  },
  applyButtonText: {
    color: 'white',
  },
});

export default DateRangePicker;