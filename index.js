import React, { Component } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback
} from "react-native";
import PropTypes from "prop-types";
import isEqual from "lodash.isequal";

const PAGE_CHANGE_DELAY = 4000;

/**
 * Animates pages in cycle
 * (loop possible if children count > 1)
 */
export default class Carousel extends Component {
  static propTypes = {
    data: PropTypes.array.isRequired,
    renderItem: PropTypes.func.isRequired,
    autoplay: PropTypes.bool,
    delay: PropTypes.number,
    currentPage: PropTypes.number,
    style: View.propTypes.style,
    pageStyle: View.propTypes.style,
    contentContainerStyle: View.propTypes.style,
    pageInfo: PropTypes.bool,
    pageInfoBackgroundColor: PropTypes.string,
    pageInfoTextStyle: Text.propTypes.style,
    pageInfoBottomContainerStyle: View.propTypes.style,
    pageInfoTextSeparator: PropTypes.string,
    bullets: PropTypes.bool,
    bulletsContainerStyle: Text.propTypes.style,
    bulletStyle: Text.propTypes.style,
    arrows: PropTypes.bool,
    arrowsContainerStyle: Text.propTypes.style,
    arrowStyle: Text.propTypes.style,
    leftArrowText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    rightArrowText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    chosenBulletStyle: Text.propTypes.style,
    onAnimateNextPage: PropTypes.func,
    swipe: PropTypes.bool,
    extraData: PropTypes.object
  };

  static defaultProps = {
    delay: PAGE_CHANGE_DELAY,
    autoplay: true,
    pageInfo: false,
    bullets: false,
    arrows: false,
    pageInfoBackgroundColor: "rgba(0, 0, 0, 0.25)",
    pageInfoTextSeparator: " / ",
    currentPage: 0,
    style: undefined,
    pageStyle: undefined,
    contentContainerStyle: undefined,
    pageInfoTextStyle: undefined,
    pageInfoBottomContainerStyle: undefined,
    bulletsContainerStyle: undefined,
    chosenBulletStyle: undefined,
    bulletStyle: undefined,
    arrowsContainerStyle: undefined,
    arrowStyle: undefined,
    leftArrowText: "",
    rightArrowText: "",
    onAnimateNextPage: undefined,
    swipe: true,
    extraData: undefined
  };

  constructor(props) {
    super(props);
    const size = { width: 0, height: 0 };
    if (props.data) {
      const childrenLength = props.data.length || 1;
      this.state = {
        currentPage: props.currentPage,
        size,
        childrenLength,
        contents: []
      };
    } else {
      this.state = { size };
    }
  }

  componentDidMount() {
    if (this.state.childrenLength) {
      this._setUpTimer();
    }
    // Set up pages
    this._setUpPages();
  }

  componentWillUnmount() {
    this._clearTimer();
  }

  componentWillReceiveProps(nextProps) {
    if (!isEqual(this.props.data, nextProps.data)) {
      let childrenLength = 0;
      this.setState({ currentPage: 0 });
      if (nextProps.data) {
        const length = nextProps.data.length;
        childrenLength = length || 1;
      }
      this.setState({ childrenLength }, () => {
        this._setUpPages();
      });
      this._setUpTimer();
    }
  }

  _setUpPages() {
    const children = this.props.data;
    if (children && children.length > 1) {
      const { size } = this.state;
      let pages = [];
      // add all pages
      pages = children.slice(0);
      // We want to make infinite pages structure like this: 1-2-3-1-2
      // so we add first and second page again to the end
      pages.push(children[0]);
      pages.push(children[1]);
      this.setState({ contents: pages });
    } else if (children && children.length == 1) {
      this.setState({ contents: children });
    }
  }

  getCurrentPage() {
    return this.state.currentPage;
  }

  _onScrollBegin = () => {
    this._clearTimer();
  };

  _setCurrentPage = currentPage => {
    this.setState({ currentPage }, () => {
      if (this.props.onAnimateNextPage) {
        // FIXME: called twice on ios with auto-scroll
        this.props.onAnimateNextPage(currentPage);
      }
    });
  };

  _onScrollEnd = event => {
    const offset = { ...event.nativeEvent.contentOffset };
    const page = this._calculateCurrentPage(offset.x);
    this._placeCritical(page);
    this._setCurrentPage(page);
    this._setUpTimer();
  };

  _onLayout = () => {
    this.container.measure((x, y, w, h) => {
      this.setState({ size: { width: w, height: h } });
      // remove setTimeout wrapper when https://github.com/facebook/react-native/issues/6849 is resolved.
      setTimeout(() => this._placeCritical(this.state.currentPage), 0);
    });
  };

  _clearTimer = () => {
    clearTimeout(this.timer);
  };

  _setUpTimer = () => {
    // only for cycling
    if (this.props.autoplay && this.props.data.length > 1) {
      this._clearTimer();
      this.timer = setTimeout(this._animateNextPage, this.props.delay);
    }
  };

  _scrollTo = ({ offset, animated, nofix }) => {
    if (this.scrollView) {
      this.scrollView.scrollToOffset({ offset: offset, animated });

      // Fix bug #50
      if (!nofix && Platform.OS === "android" && !animated) {
        this.scrollView.scrollToOffset({ offset: offset, animated: true });
      }
    }
  };

  _animateNextPage = () => {
    const { currentPage } = this.state;
    this.animateToPage(this._normalizePageNumber(currentPage + 1));
  };

  animateToPage = page => {
    let currentPage = page;
    this._clearTimer();
    const { width } = this.state.size;
    const { childrenLength } = this.state;
    if (currentPage >= childrenLength) {
      currentPage = 0;
    }
    if (currentPage === 0) {
      // animate properly based on direction
      const scrollMultiplier = this.state.currentPage === 1 ? 1 : -1;
      this._scrollTo({
        offset: (childrenLength + 1 * scrollMultiplier) * width,
        animated: false,
        nofix: true
      });
      this._scrollTo({ offset: childrenLength * width, animated: true });
    } else if (currentPage === 1) {
      const scrollMultiplier = this.state.currentPage === 0 ? 0 : 2;
      this._scrollTo({
        offset: width * scrollMultiplier,
        animated: false,
        nofix: true
      });
      this._scrollTo({ offset: width, animated: true });
    } else {
      this._scrollTo({ offset: currentPage * width, animated: true });
    }
    this._setCurrentPage(currentPage);
    this._setUpTimer();
  };

  _placeCritical = page => {
    const { childrenLength } = this.state;
    const { width } = this.state.size;
    if (childrenLength === 1 || page === 0) {
      this._scrollTo({ offset: 0, animated: false });
    } else if (page === 1) {
      this._scrollTo({ offset: width, animated: false });
    } else {
      this._scrollTo({ offset: page * width, animated: false });
    }
  };

  _normalizePageNumber = page => {
    const { childrenLength } = this.state;
    if (page === childrenLength) {
      return 0;
    } else if (page >= childrenLength) {
      return 1;
    }
    return page;
  };

  _calculateCurrentPage = offset => {
    const { width } = this.state.size;
    /*
      Originally:
      const page = Math.floor(offset / width);
      FIX to Math.round as floor was sometimes causing slides to "snap" to previous slide.
    */
    const page = Math.round(offset / width);
    return this._normalizePageNumber(page);
  };

  _renderPageInfo = pageLength => (
    <View
      style={[
        styles.pageInfoBottomContainer,
        this.props.pageInfoBottomContainerStyle
      ]}
      pointerEvents="none"
    >
      <View style={styles.pageInfoContainer}>
        <View
          style={[
            styles.pageInfoPill,
            { backgroundColor: this.props.pageInfoBackgroundColor }
          ]}
        >
          <Text style={[styles.pageInfoText, this.props.pageInfoTextStyle]}>
            {`${this.state.currentPage + 1}${
              this.props.pageInfoTextSeparator
            }${pageLength}`}
          </Text>
        </View>
      </View>
    </View>
  );

  _renderBullets = pageLength => {
    const bullets = [];
    for (let i = 0; i < pageLength; i += 1) {
      bullets.push(
        <TouchableWithoutFeedback
          onPress={() => this.animateToPage(i)}
          key={`bullet${i}`}
        >
          <View
            style={
              i === this.state.currentPage
                ? [styles.chosenBullet, this.props.chosenBulletStyle]
                : [styles.bullet, this.props.bulletStyle]
            }
          />
        </TouchableWithoutFeedback>
      );
    }
    return (
      <View style={styles.bullets} pointerEvents="box-none">
        <View
          style={[styles.bulletsContainer, this.props.bulletsContainerStyle]}
          pointerEvents="box-none"
        >
          {bullets}
        </View>
      </View>
    );
  };

  _renderArrows = () => {
    let { currentPage } = this.state;
    const { childrenLength } = this.state;
    if (currentPage < 1) {
      currentPage = childrenLength;
    }
    return (
      <View style={styles.arrows} pointerEvents="box-none">
        <View
          style={[styles.arrowsContainer, this.props.arrowsContainerStyle]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() =>
              this.animateToPage(this._normalizePageNumber(currentPage - 1))
            }
            style={this.props.arrowStyle}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                padding: 4,
                borderRadius: 18,
                margin: 3,
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              {this.props.leftArrowText && this.props.leftArrowText}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              this.animateToPage(this._normalizePageNumber(currentPage + 1))
            }
            style={this.props.arrowStyle}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.4)",
                padding: 4,
                borderRadius: 18,
                margin: 3,
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              {this.props.rightArrowText && this.props.rightArrowText}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  render() {
    const containerProps = {
      ref: c => {
        this.container = c;
      },
      onLayout: this._onLayout,
      style: [this.props.style]
    };

    const { size } = this.state;
    const childrenLength = this.props.data.length;

    return (
      <View {...containerProps}>
        <FlatList
          data={this.state.contents}
          renderItem={this.props.renderItem}
          ref={c => {
            this.scrollView = c;
          }}
          onScrollBeginDrag={this._onScrollBegin}
          onMomentumScrollEnd={this._onScrollEnd}
          alwaysBounceHorizontal={false}
          alwaysBounceVertical={false}
          contentInset={{ top: 0 }}
          automaticallyAdjustContentInsets={false}
          showsHorizontalScrollIndicator={false}
          horizontal
          pagingEnabled
          bounces={false}
          scrollEnabled={this.props.swipe}
          contentContainerStyle={[
            styles.horizontalScroll,
            this.props.contentContainerStyle,
            {
              width:
                size.width * (childrenLength + (childrenLength > 1 ? 2 : 0)),
              height: size.height
            }
          ]}
          extraData={this.props.extraData}
          getItemLayout={(data, index) => ({
            length: size.width,
            offset: size.width * index,
            index
          })}
        />
        {this.props.arrows && this._renderArrows(this.state.childrenLength)}
        {this.props.bullets && this._renderBullets(this.state.childrenLength)}
        {this.props.pageInfo && this._renderPageInfo(this.state.childrenLength)}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  horizontalScroll: {
    position: "absolute"
  },
  pageInfoBottomContainer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    backgroundColor: "transparent"
  },
  pageInfoContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  pageInfoPill: {
    width: 80,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  pageInfoText: {
    textAlign: "center"
  },
  bullets: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    height: 30,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  arrows: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "transparent"
  },
  arrowsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  bulletsContainer: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  chosenBullet: {
    margin: 10,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: "white"
  },
  bullet: {
    margin: 10,
    width: 10,
    height: 10,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderColor: "white",
    borderWidth: 1
  }
});
