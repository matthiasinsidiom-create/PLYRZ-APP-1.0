import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, SafeAreaView } from 'react-native';

interface PlayerCardProps {
  type: 'bronze' | 'silver' | 'gold';
  overall: number;
  position: string;
  name: string;
  stats: {
    tem: number;
    sch: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
  };
}

export const PlayerCard = ({ type, overall, position, name, stats }: PlayerCardProps) => {
  const getFrame = () => {
    switch (type) {
      case 'bronze': return require('../assets/cards/bronze.png');
      case 'silver': return require('../assets/cards/silver.png');
      case 'gold': return require('../assets/cards/gold.png');
    }
  };

  return (
    <View style={styles.cardContainer}>
      <Image source={getFrame()} style={styles.frame} />
      
      <Text style={styles.overall}>{overall}</Text>
      <Text style={styles.position}>{position}</Text>
      
      <Image source={require('../assets/flags/de.png')} style={styles.flag} />
      <Image source={require('../assets/clubs/rw.png')} style={styles.club} />
      
      <Image source={require('../assets/players/mueller.png')} style={styles.playerImage} />
      
      <View style={styles.nameContainer}>
        <Text style={styles.name}>{name.toUpperCase()}</Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statsColumn}>
          <Text style={styles.statText}>{stats.tem} TEM</Text>
          <Text style={styles.statText}>{stats.sch} SCH</Text>
          <Text style={styles.statText}>{stats.pas} PAS</Text>
        </View>
        <View style={styles.statsColumn}>
          <Text style={styles.statText}>{stats.dri} DRI</Text>
          <Text style={styles.statText}>{stats.def} DEF</Text>
          <Text style={styles.statText}>{stats.phy} PHY</Text>
        </View>
      </View>
    </View>
  );
};

export const PlayerCardTestScreen = () => {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PlayerCard 
          type="gold"
          overall={91}
          position="ST"
          name="Müller"
          stats={{ tem: 84, sch: 92, pas: 82, dri: 86, def: 45, phy: 78 }}
        />
        <PlayerCard 
          type="silver"
          overall={78}
          position="ST"
          name="Müller"
          stats={{ tem: 72, sch: 78, pas: 70, dri: 74, def: 38, phy: 68 }}
        />
        <PlayerCard 
          type="bronze"
          overall={64}
          position="ST"
          name="Müller"
          stats={{ tem: 60, sch: 64, pas: 58, dri: 62, def: 32, phy: 58 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  cardContainer: {
    width: 300,
    height: 440,
    marginBottom: 30,
    position: 'relative',
  },
  frame: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  overall: {
    position: 'absolute',
    left: '12%',
    top: '10%',
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
  },
  position: {
    position: 'absolute',
    left: '12%',
    top: '20%',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  flag: {
    position: 'absolute',
    left: '13%',
    top: '27%',
    width: 35,
    height: 22,
    resizeMode: 'contain',
  },
  club: {
    position: 'absolute',
    left: '13%',
    top: '34%',
    width: 35,
    height: 35,
    resizeMode: 'contain',
  },
  playerImage: {
    position: 'absolute',
    right: '5%',
    top: '10%',
    width: '70%',
    height: '55%',
    resizeMode: 'contain',
  },
  nameContainer: {
    position: 'absolute',
    top: '60%',
    width: '100%',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    position: 'absolute',
    top: '72%',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: '10%',
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
});
