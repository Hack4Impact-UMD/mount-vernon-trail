import { StyleSheet, Text, View, Image, ImageBackground } from 'react-native';

export function SplashScreen() { 
   return (
     <ImageBackground style={styles.container}
     source={require('../../assets/images/splash-screen-bg.png')}
     resizeMode="cover">
       <Image
       source={require('../../assets/images/mvt-logo.png')}
                style={styles.logo}/>
      <Image
      source={require('../../assets/images/beaver-splash.png')}
      style={styles.beaver}/>
     </ImageBackground>
   );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#693894',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },

  logo: {
      width: 195,
      height: 190,
      justifyContent:'center',
      alignItems: 'center',
      position:'absolute',
      }
,
  beaver: {
      width:300,
      height: 300,
      marginTop: 'auto',
      },

});