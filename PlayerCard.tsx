import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function PlayerCard() {
  return (
    <View style={styles.card}>
      {/* FRAME */}
      <Image
        source={require('../assets/cards/gold.png')}
        style={styles.frame}
      />

      {/* PLAYER IMAGE */}
      <Image
        source={require('../assets/players/mueller.png')}
        style={styles.player}
      />

      {/* OVERALL */}
      <Text style={styles.overall}>82</Text>

      {/* POSITION */}
      <Text style={styles.position}>ST</Text>

      {/* NAME */}
      <Text style={styles.name}>MÜLLER</Text>

      {/* STATS */}
      <Text style={styles.statLeft}>84 TEM</Text>
      <Text style={styles.statLeft2}>78 SCH</Text>
      <Text style={styles.statLeft3}>72 PAS</Text>

      <Text style={styles.statRight}>80 DRI</Text>
      <Text style={styles.statRight2}>40 DEF</Text>
      <Text style={styles.statRight3}>76 PHY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 300,
    aspectRatio: 992 / 1455,
  },

  frame: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  player: {
    position: 'absolute',
    left: '20%',
    top: '15%',
    width: '60%',
    height: '50%',
  },

  overall: {
    position: 'absolute',
    left: '10%',
    top: '8%',
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },

  position: {
    position: 'absolute',
    left: '10%',
    top: '16%',
    fontSize: 18,
    color: '#fff',
  },

  name: {
    position: 'absolute',
    top: '58%',
    width: '100%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  statLeft: {
    position: 'absolute',
    left: '25%',
    top: '72%',
    color: '#fff',
  },

  statLeft2: {
    position: 'absolute',
    left: '25%',
    top: '78%',
    color: '#fff',
  },

  statLeft3: {
    position: 'absolute',
    left: '25%',
    top: '84%',
    color: '#fff',
  },

  statRight: {
    position: 'absolute',
    left: '55%',
    top: '72%',
    color: '#fff',
  },

  statRight2: {
    position: 'absolute',
    left: '55%',
    top: '78%',
    color: '#fff',
  },

  statRight3: {
    position: 'absolute',
    left: '55%',
    top: '84%',
    color: '#fff',
  },
});
