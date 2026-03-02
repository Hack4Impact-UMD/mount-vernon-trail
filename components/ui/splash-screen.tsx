import { StyleSheet, Dimensions, Image, ImageBackground } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
      width: SCREEN_HEIGHT * 0.22,
      height: SCREEN_HEIGHT * 0.22,
      position:'absolute',
      }
,
  beaver: {
      width: SCREEN_HEIGHT * 0.35,
      height: SCREEN_HEIGHT * 0.35,
      marginTop: 'auto',
      },

});